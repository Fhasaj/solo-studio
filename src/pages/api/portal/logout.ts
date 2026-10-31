import type { NextApiRequest, NextApiResponse } from 'next';
import { CLIENT_COOKIE, sessionCookie } from '@/lib/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Set-Cookie', sessionCookie(CLIENT_COOKIE, '', 0, 'Lax'));
  return res.status(200).json({ ok: true });
}
