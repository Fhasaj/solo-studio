import type { NextApiRequest, NextApiResponse } from 'next';
import { GetClientByEmail } from '@/lib/query/clients.query';
import { sendLoginLink } from '@/lib/portal';
import { clientIp, createRateLimiter } from '@/lib/rateLimit';
import { readEmail, sendApiError } from '@/lib/validate';

const byIp = createRateLimiter(10, 60 * 60 * 1000);
const byEmail = createRateLimiter(3, 15 * 60 * 1000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!byIp.take(clientIp(req))) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });

  try {
    const email = readEmail(req.body?.email, 'email');
    const client = GetClientByEmail(email);
    if (client?.isActive && byEmail.take(email)) await sendLoginLink(client);
    // The same answer either way, so this can't be used to find out who is a client
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendApiError(res, err);
  }
}
