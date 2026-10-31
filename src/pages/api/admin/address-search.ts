import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { searchAddresses } from '@/lib/addressSearch';
import { clientIp, createRateLimiter } from '@/lib/rateLimit';

// Keeps well inside the free services' fair-use limits
const limiter = createRateLimiter(60, 60 * 1000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'GET') return res.status(405).end();
  if (!limiter.take(clientIp(req))) return res.status(429).json({ ok: false, error: 'Slow down a little' });
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  return res.status(200).json({ ok: true, data: await searchAddresses(query) });
}
