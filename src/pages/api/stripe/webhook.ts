import type { NextApiRequest, NextApiResponse } from 'next';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { GetMilestone, GetProject } from '@/lib/query/clients.query';
import { recordPayment } from '@/lib/portal';

// Stripe signs each event; the signature is checked against the raw body, so Next mustn't parse it
export const config = { api: { bodyParser: false } };

async function rawBody(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return res.status(503).json({ ok: false, error: 'Stripe is not set up' });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await rawBody(req), String(req.headers['stripe-signature'] ?? ''), secret);
  } catch {
    // Anything not signed by Stripe with our secret is ignored
    return res.status(400).json({ ok: false, error: 'Invalid signature' });
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') {
        const milestone = GetMilestone(Number(session.metadata?.milestoneId));
        const project = milestone && GetProject(milestone.projectId);
        // Only mark it paid if the full milestone amount was actually collected
        const fee = Number(session.metadata?.fee ?? 0);
        if (milestone && project && session.currency === 'gbp' && (session.amount_total ?? 0) >= milestone.amount + fee) {
          await recordPayment(project, milestone, { method: 'card', fee, reference: session.id });
        } else {
          console.error(`[stripe] Session ${session.id} did not match a payable milestone`);
        }
      }
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    // A 500 makes Stripe retry later, which is what we want if the database was briefly busy
    return res.status(500).json({ ok: false });
  }
}
