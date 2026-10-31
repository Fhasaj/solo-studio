import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { financeYear, vatOverview, vatThreshold } from '@/lib/finance';
import { sendApiError } from '@/lib/validate';

// Everything the Money pages show for a tax year
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const year = typeof req.query.year === 'string' && /^\d{4}(\/\d{2})?$/.test(req.query.year) ? req.query.year : undefined;
    const data = financeYear(year);
    return res.status(200).json({ ok: true, data: { ...data, vatThreshold: vatThreshold(), vat: vatOverview() } });
  } catch (err) {
    return sendApiError(res, err);
  }
}
