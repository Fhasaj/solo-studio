import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { createSessionToken, sessionCookie, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';
import { adminEmail, maskEmail, sendAdminCode, verifyAdminCode } from '@/lib/adminCodes';
import { checkPassword, endAllSessions, passwordProblem, passwordSource, setPassword } from '@/lib/adminSession';
import { ListAdminLogins } from '@/lib/query/security.query';
import { clientIp, createRateLimiter } from '@/lib/rateLimit';
import { sendMail } from '@/lib/mailer';
import { formatDateTime } from '@/lib/format';
import { readEnum, sendApiError, ValidationError } from '@/lib/validate';

const limiter = createRateLimiter(10, 15 * 60 * 1000);

// Keeps this browser signed in after ending every other session
async function renewSession(res: NextApiResponse, version: number) {
  res.setHeader('Set-Cookie', sessionCookie(SESSION_COOKIE, await createSessionToken(version), SESSION_MAX_AGE, 'Strict'));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, data: { email: maskEmail(adminEmail()), password: passwordSource(), logins: ListAdminLogins() } });
    }
    if (req.method !== 'POST') return res.status(405).end();
    if (!limiter.take(clientIp(req))) return res.status(429).json({ ok: false, error: 'Too many attempts. Try again later.' });
    const body = req.body ?? {};
    const action = readEnum(body.action, 'action', ['send-code', 'change-password', 'sign-out-everywhere'] as const, 'Action');

    if (action === 'send-code') {
      const sent = await sendAdminCode('account', `Requested from IP address ${clientIp(req)}.`);
      if (!sent) return res.status(502).json({ ok: false, error: "The code couldn't be emailed. Check the EMAIL_* settings." });
      return res.status(200).json({ ok: true, sentTo: maskEmail(adminEmail()) });
    }

    if (action === 'sign-out-everywhere') {
      await renewSession(res, endAllSessions());
      return res.status(200).json({ ok: true });
    }

    // Changing the password needs the current one and an emailed code
    if (typeof body.current !== 'string' || !checkPassword(body.current)) throw new ValidationError('current', 'Your current password is wrong');
    const next = typeof body.next === 'string' ? body.next : '';
    const problem = passwordProblem(next);
    if (problem) throw new ValidationError('next', problem);
    if (checkPassword(next)) throw new ValidationError('next', "That's your current password");
    if (!verifyAdminCode('account', body.code)) throw new ValidationError('code', "That code isn't right or has expired");
    setPassword(next);
    await renewSession(res, endAllSessions());
    await sendMail({
      to: adminEmail(),
      subject: 'Your admin password was changed',
      text: `Your admin password was changed on ${formatDateTime(new Date())} (UK time) from IP address ${clientIp(req)}. Every other session was signed out.\n\nIf this wasn't you, reset it straight away by removing the stored password from the server and signing in with ADMIN_PASSWORD.`,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendApiError(res, err);
  }
}
