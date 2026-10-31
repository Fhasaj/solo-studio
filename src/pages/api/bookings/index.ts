import type { NextApiRequest, NextApiResponse } from 'next';
import { createBooking, getAvailability, sendBookingEmails } from '@/lib/booking';
import { GetBooking } from '@/lib/query/bookings.query';
import { clientIp, createRateLimiter } from '@/lib/rateLimit';
import { readEmail, readEnum, readText, sendApiError, ValidationError } from '@/lib/validate';

const limiter = createRateLimiter(5, 60 * 60 * 1000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Free slots, so the booking page can refresh after a slot is taken
  if (req.method === 'GET') return res.status(200).json({ ok: true, data: getAvailability() });
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body ?? {};
  // Bots fill in every field, including this hidden one; pretend it worked
  if (body.website) return res.status(200).json({ ok: true });
  if (!limiter.take(clientIp(req))) return res.status(429).json({ ok: false, error: 'Too many bookings from your connection. Please email me instead.' });

  try {
    const start = readText(body.start, 'start', { label: 'Time', max: 40, required: true });
    if (Number.isNaN(Date.parse(start))) throw new ValidationError('start', 'Choose a time');
    const callType = readEnum(body.callType, 'callType', ['phone', 'video'] as const, 'Call type');
    const phone = readText(body.phone, 'phone', { label: 'Phone number', max: 30, required: callType === 'phone' });
    if (phone && !/^[+()\d\s-]{7,30}$/.test(phone)) throw new ValidationError('phone', "That phone number doesn't look right");

    const result = createBooking({
      start,
      callType,
      phone,
      name: readText(body.name, 'name', { label: 'Name', max: 100, required: true }),
      email: readEmail(body.email, 'email'),
      company: readText(body.company, 'company', { label: 'Company', max: 150 }),
      industry: readText(body.industry, 'industry', { label: 'Industry', max: 80 }),
      message: readText(body.message, 'message', { label: 'What you need', max: 3000, multiline: true }),
    });
    if (!result) {
      return res.status(409).json({ ok: false, error: 'Sorry, that time has just been taken. Please pick another.', field: 'start' });
    }

    const booking = GetBooking(result.id)!;
    await sendBookingEmails(booking, result.cancelToken);
    return res.status(200).json({ ok: true, data: { startsAt: booking.startsAt, callType: booking.callType } });
  } catch (err) {
    return sendApiError(res, err);
  }
}
