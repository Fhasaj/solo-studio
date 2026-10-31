import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { BANK_UNLOCK_COOKIE, BANK_UNLOCK_MAX_AGE, createBankUnlockToken, sessionCookie, verifyBankUnlockToken } from '@/lib/auth';
import { adminEmail, maskEmail, sendAdminCode, verifyAdminCode } from '@/lib/adminCodes';
import { GetBankDetails, maskBankDetails, SaveBankDetails } from '@/lib/bankDetails';
import { clientIp, createRateLimiter } from '@/lib/rateLimit';
import { sendMail } from '@/lib/mailer';
import { formatDateTime } from '@/lib/format';
import { readEnum, readText, sendApiError, ValidationError } from '@/lib/validate';

// The unlock cookie is only ever sent to this endpoint
const COOKIE_PATH = '/api/admin/bank';
const codeLimiter = createRateLimiter(5, 15 * 60 * 1000);

function details(unlocked: boolean) {
  const { updatedAt, ...bank } = GetBankDetails();
  return { ...(unlocked ? bank : maskBankDetails(bank)), updatedAt, unlocked };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const unlocked = await verifyBankUnlockToken(req.cookies[BANK_UNLOCK_COOKIE]);
  const body = req.body ?? {};

  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, data: details(unlocked) });

    if (req.method === 'POST') {
      const action = readEnum(body.action, 'action', ['send-code', 'unlock', 'lock'] as const, 'Action');
      if (action === 'send-code') {
        if (!codeLimiter.take(clientIp(req))) return res.status(429).json({ ok: false, error: 'Too many codes requested. Try again later.' });
        const sent = await sendAdminCode('bank', `Requested from IP address ${clientIp(req)}.`);
        if (!sent) return res.status(502).json({ ok: false, error: "The code couldn't be emailed. Check the EMAIL_* settings." });
        return res.status(200).json({ ok: true, sentTo: maskEmail(adminEmail()) });
      }
      if (action === 'lock') {
        res.setHeader('Set-Cookie', sessionCookie(BANK_UNLOCK_COOKIE, '', 0, 'Strict', COOKIE_PATH));
        return res.status(200).json({ ok: true, data: details(false) });
      }
      if (!verifyAdminCode('bank', body.code)) throw new ValidationError('code', "That code isn't right or has expired.");
      res.setHeader('Set-Cookie', sessionCookie(BANK_UNLOCK_COOKIE, await createBankUnlockToken(), BANK_UNLOCK_MAX_AGE, 'Strict', COOKIE_PATH));
      return res.status(200).json({ ok: true, data: details(true) });
    }

    if (req.method === 'PUT') {
      if (!unlocked) return res.status(403).json({ ok: false, error: 'Enter the emailed code to change bank details.' });
      const values = body.values ?? {};
      const next = {
        bankAccountName: readText(values.bankAccountName, 'bankAccountName', { label: 'Account name', max: 70, required: true }),
        bankSortCode: readText(values.bankSortCode, 'bankSortCode', { label: 'Sort code', max: 8, required: true }).replace(/[\s]/g, ''),
        bankAccountNumber: readText(values.bankAccountNumber, 'bankAccountNumber', { label: 'Account number', max: 8, required: true }),
      };
      if (/^\d{6}$/.test(next.bankSortCode)) next.bankSortCode = next.bankSortCode.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3');
      if (!/^\d{2}-\d{2}-\d{2}$/.test(next.bankSortCode)) throw new ValidationError('bankSortCode', 'Sort code must look like 12-34-56');
      if (!/^\d{8}$/.test(next.bankAccountNumber)) throw new ValidationError('bankAccountNumber', 'Account number must be 8 digits');

      const before = maskBankDetails(GetBankDetails());
      SaveBankDetails(next);
      const after = maskBankDetails(next);
      // Swapping the account number is how payment fraud usually works, so every change is reported
      await sendMail({
        to: adminEmail(),
        subject: 'Your bank details were changed',
        text: [
          `The bank details clients see when paying were changed on ${formatDateTime(new Date())} (UK time) from IP address ${clientIp(req)}.`,
          '',
          `Before: ${before.bankAccountName || '-'}, ${before.bankSortCode || '-'}, ${before.bankAccountNumber || '-'}`,
          `After: ${after.bankAccountName}, ${after.bankSortCode}, ${after.bankAccountNumber}`,
          '',
          "If this wasn't you, change your admin password (Admin → Account) and your email password straight away, then put the correct details back.",
        ].join('\n'),
      });
      return res.status(200).json({ ok: true, data: details(true) });
    }

    return res.status(405).end();
  } catch (err) {
    return sendApiError(res, err);
  }
}
