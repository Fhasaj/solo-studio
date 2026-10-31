/*
 * @name: Formatting
 * @description: Money and date formatting in UK conventions, and the UK timezone maths used by bookings.
 * */

export const TIMEZONE = 'Europe/London';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const gbpWhole = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

export function formatPence(pence: number) {
  return pence % 100 === 0 ? gbpWhole.format(pence / 100) : gbp.format(pence / 100);
}

// Pounds as stored in settings ("3000") → "£3,000"
export function formatPounds(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? gbpWhole.format(number) : String(value);
}

export function penceToInput(pence: number) {
  return pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);
}

// UTC offset of UK time at an instant, in ms (0 in winter, 3,600,000 in summer)
function londonOffset(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

// A UK wall-clock time ("2026-11-03", "09:20") as a real instant
export function londonToDate(day: string, time: string) {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, date, hour, minute);
  const first = guess - londonOffset(new Date(guess));
  // Re-check in case the guess and the answer sit either side of a clock change
  return new Date(guess - londonOffset(new Date(first)));
}

// The UK calendar date of an instant, as YYYY-MM-DD
export function londonDay(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function addDays(day: string, days: number) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

// 0 = Sunday … 6 = Saturday
export function weekday(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function formatDate(value: string | Date) {
  // Bare dates are calendar dates, not instants
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function formatDayLabel(day: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${day}T12:00:00Z`));
}

// SQLite CURRENT_TIMESTAMP values are UTC without a zone marker
export function sqliteToIso(value: string | null | undefined) {
  if (!value) return null;
  return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
}

// YYYY-MM-DD plus whole months; 31 Aug + 6 months is 28/29 Feb, not March
export function addMonths(day: string, months: number) {
  const [year, month, date] = day.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1 + months, date));
  if (result.getUTCDate() !== date) result.setUTCDate(0);
  return result.toISOString().slice(0, 10);
}
