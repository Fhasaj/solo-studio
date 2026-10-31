import type { NextApiRequest, NextApiResponse } from 'next';
import { requireClient } from '@/lib/requireClient';
import { GetClientProject, GetMilestone, ListMilestones } from '@/lib/query/clients.query';
import { cardFee, describeMilestones } from '@/lib/portal';
import { getStripe, stripeReady } from '@/lib/stripe';
import { absoluteUrl } from '@/lib/site';
import { readEnum, readId, sendApiError } from '@/lib/validate';

// Starts a Stripe Checkout payment for a milestone the client owes. The amount always comes from the database.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const client = await requireClient(req, res);
  if (!client) return;

  try {
    const milestone = GetMilestone(readId(req.body?.milestoneId, 'milestoneId'));
    const project = milestone && GetClientProject(milestone.projectId, client.id);
    if (!milestone || !project) return res.status(404).json({ ok: false, error: 'Not found' });
    if (!project.allowCard || !stripeReady()) return res.status(400).json({ ok: false, error: 'Card payment isn’t available for this project. Please pay by bank transfer.' });
    if (milestone.status !== 'awaiting_payment' || milestone.paidAt) return res.status(400).json({ ok: false, error: 'No payment is due for this milestone.' });

    // UK law: a fee can only be added for business (commercial) cards, never personal ones
    const cardType = readEnum(req.body?.cardType, 'cardType', ['business', 'personal'] as const, 'Card type');
    const fee = cardType === 'business' ? cardFee(milestone.amount) : 0;
    const view = describeMilestones(project, ListMilestones(project.id)).find((m) => m.id === milestone.id)!;
    const back = absoluteUrl(`/portal/projects/${project.id}`);

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      // Cards only, so the fee line (business cards) is accurate; bank transfer is offered separately and free
      allowed_payment_method_types: ['card'],
      customer_email: client.email,
      client_reference_id: String(milestone.id),
      metadata: { milestoneId: String(milestone.id), projectId: String(project.id), fee: String(fee) },
      payment_intent_data: {
        description: `${project.reference}: ${milestone.title}`,
        metadata: { milestoneId: String(milestone.id), projectId: String(project.id) },
      },
      line_items: [
        {
          quantity: 1,
          price_data: { currency: 'gbp', unit_amount: milestone.amount, product_data: { name: `${milestone.title} (${project.title})`, description: `Reference ${view.paymentReference}` } },
        },
        ...(fee
          ? [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: fee, product_data: { name: 'Business card processing fee' } } }]
          : []),
      ],
      success_url: `${back}?paid=1`,
      cancel_url: back,
      // Checkout links stop working after a day; the client can always start a new one
      expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
    });
    return res.status(200).json({ ok: true, url: session.url });
  } catch (err) {
    return sendApiError(res, err);
  }
}
