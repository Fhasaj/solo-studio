import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { searchAdmin } from '@/lib/search';
import { sendApiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'GET') return res.status(405).end();
  try {
    return res.status(200).json({ ok: true, data: searchAdmin(typeof req.query.q === 'string' ? req.query.q : '') });
  } catch (err) {
    return sendApiError(res, err);
  }
}
