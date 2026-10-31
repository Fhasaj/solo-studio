import type { NextApiRequest, NextApiResponse } from 'next';
import { createSessionToken, PENDING_COOKIE, sessionCookie, SESSION_COOKIE, SESSION_MAX_AGE, verifyPendingToken } from '@/lib/auth';
import { verifyAdminCode } from '@/lib/adminCodes';
import { clientIp, createRateLimiter } from '@/lib/rateLimit';

const limiter = createRateLimiter(10, 15 * 60 * 1000);

// Step 2 of 2: the emailed code. Only works straight after a correct password (the pending cookie).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!limiter.take(clientIp(req))) return res.status(429).json({ ok: false, error: 'Too many attempts. Try again later.' });

  if (!(await verifyPendingToken(req.cookies[PENDING_COOKIE]))) {
    return res.status(401).json({ ok: false, error: 'Your sign-in timed out. Enter your password again.', restart: true });
  }
  if (!verifyAdminCode('login', req.body?.code)) {
    return res.status(401).json({ ok: false, error: "That code isn't right or has expired." });
  }

  res.setHeader('Set-Cookie', [
    sessionCookie(SESSION_COOKIE, await createSessionToken(), SESSION_MAX_AGE, 'Strict'),
    sessionCookie(PENDING_COOKIE, '', 0, 'Strict'),
  ]);
  return res.status(200).json({ ok: true });
}
