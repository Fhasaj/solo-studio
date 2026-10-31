import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { DeleteMileage, DeleteOtherIncome, InsertMileage, InsertOtherIncome } from '@/lib/query/finance.query';
import { readDate, readEnum, readId, readMoney, readText, sendApiError, ValidationError } from '@/lib/validate';

// Mileage trips and income received outside invoices
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const body = req.body ?? {};
  try {
    const kind = readEnum(body.kind, 'kind', ['mileage', 'income'] as const, 'Kind');
    if (req.method === 'POST') {
      const date = readDate(body.date, 'date', { label: 'Date', required: true });
      if (kind === 'mileage') {
        const distance = Number(String(body.distance ?? '').replace(/,/g, ''));
        if (!Number.isFinite(distance) || distance <= 0 || distance > 5000) throw new ValidationError('distance', 'Enter the distance for this trip');
        // The amount is worked out from HMRC rates in the yearly figures; stored as 0 here
        const id = InsertMileage({
          date,
          purpose: readText(body.purpose, 'purpose', { label: 'Purpose', max: 200, required: true }),
          route: readText(body.route, 'route', { label: 'Route', max: 200 }),
          distance: Math.round(distance * 10) / 10,
          vehicle: readEnum(body.vehicle ?? 'car', 'vehicle', ['car', 'motorcycle', 'bicycle'] as const, 'Vehicle'),
          amount: 0,
        });
        return res.status(200).json({ ok: true, id });
      }
      const id = InsertOtherIncome({
        date,
        description: readText(body.description, 'description', { label: 'Description', max: 200, required: true }),
        amount: readMoney(body.amount, 'amount', { label: 'Amount' }),
        vat: readMoney(body.vat || '0', 'vat', { label: 'VAT' }),
      });
      return res.status(200).json({ ok: true, id });
    }
    if (req.method === 'DELETE') {
      const id = readId(body.id);
      if (kind === 'mileage') DeleteMileage(id);
      else DeleteOtherIncome(id);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (err) {
    return sendApiError(res, err);
  }
}
