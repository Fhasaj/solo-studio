import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { vatOverview } from '@/lib/finance';
import { DeleteVatReturn, InsertVatReturn } from '@/lib/query/finance.query';
import { readDate, readEnum, readText, sendApiError, ValidationError } from '@/lib/validate';

// Marks a VAT period as filed (keeping a copy of the figures), or undoes that
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'PATCH') return res.status(405).end();
  const body = req.body ?? {};
  try {
    const start = readDate(body.start, 'start', { label: 'Start', required: true });
    const end = readDate(body.end, 'end', { label: 'End', required: true });
    const action = readEnum(body.action, 'action', ['submitted', 'undo'] as const, 'Action');
    if (action === 'undo') {
      DeleteVatReturn(start, end);
      return res.status(200).json({ ok: true });
    }
    const period = vatOverview().periods.find((p) => p.start === start && p.end === end);
    if (!period) throw new ValidationError('start', 'That VAT period was not found');
    if (period.open) throw new ValidationError('start', "This period hasn't ended yet");
    InsertVatReturn(start, end, period.boxes, readText(body.reference, 'reference', { label: 'Reference', max: 60 }));
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendApiError(res, err);
  }
}
