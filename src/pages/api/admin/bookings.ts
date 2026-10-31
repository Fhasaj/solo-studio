import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { BOOKING_STATUSES, GetBooking, ListBookings, ListBookingsBetween, SetBookingStatus } from '@/lib/query/bookings.query';
import { londonToDate } from '@/lib/format';
import { readDate, readEnum, readId, sendApiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;

  try {
    if (req.method === 'GET' && req.query.from) {
      // Calendar view: UK calendar dates, end exclusive
      const from = readDate(req.query.from, 'from', { label: 'From', required: true });
      const to = readDate(req.query.to, 'to', { label: 'To', required: true });
      return res.status(200).json({ ok: true, data: ListBookingsBetween(londonToDate(from, '00:00').toISOString(), londonToDate(to, '00:00').toISOString()) });
    }
    if (req.method === 'GET') {
      const scope = req.query.scope === 'past' ? 'past' : 'upcoming';
      return res.status(200).json({ ok: true, data: ListBookings(scope) });
    }
    if (req.method === 'PATCH') {
      const id = readId(req.body?.id);
      if (!GetBooking(id)) return res.status(404).json({ ok: false, error: 'Not found' });
      SetBookingStatus(id, readEnum(req.body?.status, 'status', BOOKING_STATUSES, 'Status'));
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (err) {
    return sendApiError(res, err);
  }
}
