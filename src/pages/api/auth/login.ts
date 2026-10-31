import type { NextApiRequest, NextApiResponse } from 'next';
import { createPendingToken, PENDING_COOKIE, PENDING_MAX_AGE, safeEqual, sessionCookie } from '@/lib/auth';
import { adminEmail, maskEmail, sendAdminCode } from '@/lib/adminCodes';
import { clientIp } from '@/lib/rateLimit';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

// Step 1 of 2: check the password, then email a one-time code. The session is only created in /api/auth/verify.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const ip = clientIp(req);
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ ok: false, error: 'Too many attempts. Try again later.' });
  }

  const expected = process.env.ADMIN_PASSWORD;
  const { password } = req.body ?? {};

  if (!expected || typeof password !== 'string' || !safeEqual(password, expected)) {
    const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + WINDOW_MS };
    current.count += 1;
    attempts.set(ip, current);
    return res.status(401).json({ ok: false, error: 'Incorrect password' });
  }

  attempts.delete(ip);
  try {
    const sent = await sendAdminCode('login', `Requested from IP address ${ip}.`);
    if (!sent) return res.status(502).json({ ok: false, error: "The sign-in code couldn't be emailed. Check the EMAIL_* settings." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
  res.setHeader('Set-Cookie', sessionCookie(PENDING_COOKIE, await createPendingToken(), PENDING_MAX_AGE, 'Strict'));
  return res.status(200).json({ ok: true, step: 'code', sentTo: maskEmail(adminEmail()) });
}
