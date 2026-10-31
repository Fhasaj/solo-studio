/*
 * @name: Booking
 * @description: Works out which call slots are free (in UK time), creates bookings and sends the confirmation emails.
 * */

import { createHash, randomBytes } from 'crypto';
import { GetSiteSettings } from './query/settings.query';
import { InsertBookingIfFree, ListConfirmedBookingsBetween, type Booking, type CallType } from './query/bookings.query';
import { parseHours, type SiteSettings } from './siteSettings';
import { addDays, formatDateTime, formatDayLabel, formatTime, londonDay, londonToDate, weekday } from './format';
import { sendMail } from './mailer';
import { absoluteUrl, SITE_HOST } from './site';

const HOURS_KEYS = ['bookingHoursSun', 'bookingHoursMon', 'bookingHoursTue', 'bookingHoursWed', 'bookingHoursThu', 'bookingHoursFri', 'bookingHoursSat'] as const;

export interface DaySlots {
  day: string;
  label: string;
  slots: { start: string; time: string }[];
}

function bookingRules(settings: SiteSettings) {
  return {
    slotMs: Number(settings.bookingSlotMinutes) * 60_000,
    bufferMs: Number(settings.bookingBufferMinutes) * 60_000,
    noticeMs: Number(settings.bookingMinNoticeHours) * 3_600_000,
    horizonDays: Number(settings.bookingHorizonDays),
    blocked: new Set(settings.bookingBlockedDates.split('\n').map((line) => line.trim()).filter(Boolean)),
  };
}

// Every free slot from now until the booking horizon, grouped by UK date
export function getAvailability(now = new Date(), settings = GetSiteSettings()): DaySlots[] {
  const { slotMs, bufferMs, noticeMs, horizonDays, blocked } = bookingRules(settings);
  const today = londonDay(now);
  const earliest = now.getTime() + noticeMs;
  const lastDay = addDays(today, horizonDays);

  const taken = ListConfirmedBookingsBetween(new Date(now.getTime() - bufferMs).toISOString(), londonToDate(addDays(lastDay, 1), '00:00').toISOString()).map(
    (booking) => ({ start: Date.parse(booking.startsAt), end: Date.parse(booking.endsAt) })
  );

  const days: DaySlots[] = [];
  for (let offset = 0; offset <= horizonDays; offset++) {
    const day = addDays(today, offset);
    if (blocked.has(day)) continue;

    let ranges: { start: string; end: string }[];
    try {
      ranges = parseHours(settings[HOURS_KEYS[weekday(day)]]);
    } catch {
      ranges = []; // invalid hours are rejected when saved, so this only guards old data
    }

    const slots: DaySlots['slots'] = [];
    for (const range of ranges) {
      const rangeEnd = londonToDate(day, range.end).getTime();
      for (let start = londonToDate(day, range.start).getTime(); start + slotMs <= rangeEnd; start += slotMs + bufferMs) {
        const end = start + slotMs;
        if (start < earliest) continue;
        // Keep the buffer clear on both sides of every existing booking
        if (taken.some((booking) => start < booking.end + bufferMs && booking.start < end + bufferMs)) continue;
        slots.push({ start: new Date(start).toISOString(), time: formatTime(new Date(start)) });
      }
    }
    if (slots.length) days.push({ day, label: formatDayLabel(day), slots });
  }
  return days;
}

export function isSlotAvailable(start: string, settings = GetSiteSettings()) {
  return getAvailability(new Date(), settings).some((day) => day.slots.some((slot) => slot.start === start));
}

// Visitors can cancel their own booking online until it starts
export function canCancel(booking: Booking) {
  return booking.status === 'confirmed' && Date.parse(booking.startsAt) > Date.now();
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken() {
  return randomBytes(32).toString('base64url');
}

export interface BookingRequest {
  start: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  message: string;
  callType: CallType;
}

// Returns the new booking id and its cancel token, or null if the slot was taken in the meantime
export function createBooking(request: BookingRequest) {
  const settings = GetSiteSettings();
  const startMs = Date.parse(request.start);
  const cancelToken = newToken();
  const id = InsertBookingIfFree(
    {
      ...request,
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(startMs + Number(settings.bookingSlotMinutes) * 60_000).toISOString(),
      cancelTokenHash: hashToken(cancelToken),
    },
    () => isSlotAvailable(new Date(startMs).toISOString(), settings)
  );
  return id === null ? null : { id, cancelToken };
}

// ---- Calendar invite (.ics) ----

function icsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsDate(iso: string) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Lines longer than 75 bytes must be folded
function foldLine(line: string) {
  const chunks: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    chunks.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  chunks.push(rest);
  return chunks.join('\r\n');
}

export function bookingIcs(booking: Booking, { summary, description, location }: { summary: string; description: string; location: string }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${SITE_HOST}//Bookings//EN`,
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${booking.id}@${SITE_HOST}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(booking.startsAt)}`,
    `DTEND:${icsDate(booking.endsAt)}`,
    `SUMMARY:${icsText(summary)}`,
    `DESCRIPTION:${icsText(description)}`,
    `LOCATION:${icsText(location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// ---- Emails ----

function callDetails(booking: Booking, settings: SiteSettings) {
  if (booking.callType === 'phone') return `Phone call: I'll ring you on ${booking.phone}.`;
  return settings.bookingVideoLink
    ? `Video call: join at ${settings.bookingVideoLink}`
    : "Video call: I'll email you a link before the call.";
}

export async function sendBookingEmails(booking: Booking, cancelToken: string) {
  const settings = GetSiteSettings();
  const when = formatDateTime(booking.startsAt);
  const minutes = Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60_000);
  const details = callDetails(booking, settings);
  const cancelUrl = absoluteUrl(`/book/cancel?token=${encodeURIComponent(cancelToken)}`);

  const clientIcs = bookingIcs(booking, {
    summary: `Call with ${settings.ownerName}`,
    description: `${details}\n\nNeed to cancel? ${cancelUrl}`,
    location: booking.callType === 'video' ? settings.bookingVideoLink || 'Video call' : `Phone: ${booking.phone}`,
  });
  const adminIcs = bookingIcs(booking, {
    summary: `Call: ${booking.name}${booking.company ? ` (${booking.company})` : ''}`,
    description: `${booking.callType === 'phone' ? `Ring ${booking.phone}` : 'Video call'}\n\n${booking.message}`,
    location: booking.callType === 'video' ? settings.bookingVideoLink || 'Video call' : booking.phone,
  });

  await Promise.all([
    sendMail({
      to: booking.email,
      replyTo: settings.contactEmail || undefined,
      subject: `Your call with ${settings.ownerName} is booked: ${when}`,
      text: [
        `Hi ${booking.name},`,
        '',
        `Thanks for booking a free ${minutes}-minute call. Here are the details:`,
        '',
        `When: ${when} (UK time)`,
        details,
        '',
        "There's a calendar file attached so you can add it to your calendar.",
        '',
        `If you need to cancel, use this link: ${cancelUrl}`,
        '',
        'Speak soon,',
        settings.ownerName,
      ].join('\n'),
      attachments: [{ filename: 'call.ics', content: clientIcs, contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }],
    }),
    sendMail({
      to: settings.contactEmail || process.env.EMAIL_TO || '',
      replyTo: booking.email,
      subject: `New call booked: ${booking.name}${booking.company ? `, ${booking.company}` : ''} on ${when}`,
      text: [
        `When: ${when} (UK time, ${minutes} minutes)`,
        `Call: ${booking.callType === 'phone' ? `phone, ring ${booking.phone}` : 'video'}`,
        '',
        `Name: ${booking.name}`,
        `Email: ${booking.email}`,
        `Phone: ${booking.phone || '-'}`,
        `Company: ${booking.company || '-'}`,
        `Industry: ${booking.industry || '-'}`,
        '',
        'What they need:',
        booking.message || '-',
        '',
        `Manage bookings: ${absoluteUrl('/admin/Bookings')}`,
      ].join('\n'),
      attachments: [{ filename: 'call.ics', content: adminIcs, contentType: 'text/calendar; charset=utf-8; method=PUBLISH' }],
    }),
  ]);
}

export async function sendCancellationEmail(booking: Booking) {
  const settings = GetSiteSettings();
  await sendMail({
    to: settings.contactEmail || process.env.EMAIL_TO || '',
    subject: `Call cancelled: ${booking.name} on ${formatDateTime(booking.startsAt)}`,
    text: `${booking.name} (${booking.email}) cancelled their call on ${formatDateTime(booking.startsAt)}.`,
  });
}
