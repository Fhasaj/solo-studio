import type { NextApiRequest, NextApiResponse } from 'next';
import { CLIENT_COOKIE, CLIENT_MAX_AGE, createClientSessionToken, sessionCookie } from '@/lib/auth';
import { hashToken } from '@/lib/booking';
import { ConsumeLoginToken, GetClient } from '@/lib/query/clients.query';
import { readText, sendApiError } from '@/lib/validate';

// A POST rather than following the emailed link directly, so link scanners in mail apps can't use up the token
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const token = readText(req.body?.token, 'token', { label: 'Link', max: 100, required: true });
    const clientId = ConsumeLoginToken(hashToken(token));
    const client = clientId ? GetClient(clientId) : null;
    if (!client?.isActive) {
      return res.status(400).json({ ok: false, error: 'That link has expired or has already been used. Request a new one below.' });
    }
    // Lax so links to the portal in emails arrive signed in
    res.setHeader('Set-Cookie', sessionCookie(CLIENT_COOKIE, await createClientSessionToken(client.id), CLIENT_MAX_AGE, 'Lax'));
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendApiError(res, err);
  }
}
