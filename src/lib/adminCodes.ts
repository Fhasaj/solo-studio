/*
 * @name: Admin one-time codes
 * @description: 6-digit codes emailed to the admin for signing in and for unlocking bank details.
 * Codes go to ADMIN_EMAIL from the environment, never to an address that can be changed in the admin,
 * so a stolen session can't redirect them.
 * */

import { createHmac, randomInt } from 'crypto';
import { safeEqual } from './auth';
import { ExpireAdminCode, GetLiveAdminCode, InsertAdminCode, RecordAdminCodeAttempt } from './query/security.query';
import { sendMail } from './mailer';

export type CodePurpose = 'login' | 'bank';

const LIFETIME_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

const PURPOSE_TEXT: Record<CodePurpose, string> = {
  login: 'sign in to your website admin',
  bank: 'view or change the bank details on your website',
};

export function adminEmail() {
  return process.env.ADMIN_EMAIL || process.env.EMAIL_TO || '';
}

// "alex@example.com" → "al••••@example.com"
export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  return domain ? `${name.slice(0, 2)}••••@${domain}` : '';
}

function hashCode(purpose: CodePurpose, code: string) {
  return createHmac('sha256', process.env.SECRET_KEY ?? '').update(`${purpose}:${code}`).digest('hex');
}

// Returns false if the email couldn't be sent
export async function sendAdminCode(purpose: CodePurpose, context = '') {
  const to = adminEmail();
  if (!to) throw new Error('Set ADMIN_EMAIL so sign-in codes have somewhere to go');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  InsertAdminCode(purpose, hashCode(purpose, code), new Date(Date.now() + LIFETIME_MS).toISOString());

  // Local development without email set up: the code goes to the server console instead
  if (!process.env.EMAIL_HOST && process.env.NODE_ENV !== 'production') {
    console.info(`[admin code] ${purpose}: ${code}`);
    return true;
  }
  const sent = await sendMail({
    to,
    // The code stays out of the subject, so it doesn't show on a lock screen
    subject: purpose === 'login' ? 'Your admin sign-in code' : 'Your code to unlock bank details',
    text: [
      `Your code is: ${code}`,
      '',
      `Use it to ${PURPOSE_TEXT[purpose]}. It expires in 10 minutes and works once.`,
      context,
      '',
      "If this wasn't you, someone may know your admin password: change ADMIN_PASSWORD straight away.",
    ]
      .filter((line) => line !== undefined)
      .join('\n'),
  });
  // Local development only: if the email fails, print the code so you aren't locked out of your own dev server
  if (!sent && process.env.NODE_ENV !== 'production') {
    console.info(`[admin code] Email failed, so here is the ${purpose} code for development: ${code}`);
    return true;
  }
  return sent;
}

// Checks a code. Each code allows 5 tries, then a new one is needed.
export function verifyAdminCode(purpose: CodePurpose, input: unknown) {
  const code = typeof input === 'string' ? input.replace(/\s/g, '') : '';
  const live = GetLiveAdminCode(purpose);
  if (!live || !/^\d{6}$/.test(code)) return false;
  if (live.attempts >= MAX_ATTEMPTS) {
    ExpireAdminCode(live.id);
    return false;
  }
  const ok = safeEqual(live.codeHash, hashCode(purpose, code));
  RecordAdminCodeAttempt(live.id, ok);
  return ok;
}
