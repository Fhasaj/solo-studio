import type { NextApiRequest, NextApiResponse } from 'next';
import { canCancel, hashToken, sendCancellationEmail } from '@/lib/booking';
import { GetBookingByCancelHash, SetBookingStatus } from '@/lib/query/bookings.query';
import { readText, sendApiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const token = readText(req.body?.token, 'token', { label: 'Link', max: 100, required: true });
    const booking = GetBookingByCancelHash(hashToken(token));
    if (!booking) return res.status(404).json({ ok: false, error: "That cancellation link isn't valid." });
    if (!canCancel(booking)) {
      return res.status(400).json({ ok: false, error: 'This call can no longer be cancelled online. Please email me instead.' });
    }
    SetBookingStatus(booking.id, 'cancelled');
    await sendCancellationEmail(booking);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendApiError(res, err);
  }
}
