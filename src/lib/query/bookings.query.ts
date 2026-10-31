import { getDb } from '../dbConnect';
import { runMigrations } from '../migrate';
import { sqliteToIso } from '../format';

const db = getDb('bookings');

runMigrations(db, [
  {
    id: '2026-10-30-bookings',
    up: (db) => {
      db.exec(`
        CREATE TABLE bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          startsAt TEXT NOT NULL,
          endsAt TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          company TEXT NOT NULL DEFAULT '',
          industry TEXT NOT NULL DEFAULT '',
          message TEXT NOT NULL DEFAULT '',
          callType TEXT NOT NULL CHECK (callType IN ('phone', 'video')),
          status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
          cancelTokenHash TEXT NOT NULL UNIQUE,
          clientId INTEGER,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        -- Two live bookings can never share a start time, even if two requests race
        CREATE UNIQUE INDEX bookings_one_per_slot ON bookings (startsAt) WHERE status = 'confirmed';
        CREATE INDEX bookings_starts_at ON bookings (startsAt);
      `);
    },
  },
]);

export const BOOKING_STATUSES = ['confirmed', 'cancelled', 'completed', 'no_show'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type CallType = 'phone' | 'video';

export interface Booking {
  id: number;
  startsAt: string;
  endsAt: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  message: string;
  callType: CallType;
  status: BookingStatus;
  clientId: number | null;
  createdAt: string | null;
}

export type NewBooking = Omit<Booking, 'id' | 'status' | 'clientId' | 'createdAt'> & { cancelTokenHash: string };

const COLUMNS = 'id, startsAt, endsAt, name, email, phone, company, industry, message, callType, status, clientId, createdAt';

function toBooking(row: Booking): Booking {
  return { ...row, createdAt: sqliteToIso(row.createdAt) };
}

// Confirmed bookings overlapping [from, to), as ISO strings
export function ListConfirmedBookingsBetween(from: string, to: string) {
  return db
    .prepare("SELECT startsAt, endsAt FROM bookings WHERE status = 'confirmed' AND startsAt < ? AND endsAt > ?")
    .all(to, from) as { startsAt: string; endsAt: string }[];
}

// Runs check-then-insert under one write lock, so the availability check can't go stale
export function InsertBookingIfFree(booking: NewBooking, isFree: () => boolean) {
  return db.transaction(() => {
    if (!isFree()) return null;
    const info = db
      .prepare(
        `INSERT INTO bookings (startsAt, endsAt, name, email, phone, company, industry, message, callType, cancelTokenHash)
         VALUES (@startsAt, @endsAt, @name, @email, @phone, @company, @industry, @message, @callType, @cancelTokenHash)`
      )
      .run(booking);
    return Number(info.lastInsertRowid);
  }).immediate();
}

export function GetBooking(id: number) {
  const row = db.prepare(`SELECT ${COLUMNS} FROM bookings WHERE id = ?`).get(id) as Booking | undefined;
  return row ? toBooking(row) : null;
}

export function GetBookingByCancelHash(hash: string) {
  const row = db.prepare(`SELECT ${COLUMNS} FROM bookings WHERE cancelTokenHash = ?`).get(hash) as Booking | undefined;
  return row ? toBooking(row) : null;
}

export function ListBookings(scope: 'upcoming' | 'past') {
  const now = new Date().toISOString();
  const sql =
    scope === 'upcoming'
      ? `SELECT ${COLUMNS} FROM bookings WHERE endsAt >= ? ORDER BY startsAt`
      : `SELECT ${COLUMNS} FROM bookings WHERE endsAt < ? ORDER BY startsAt DESC LIMIT 200`;
  return (db.prepare(sql).all(now) as Booking[]).map(toBooking);
}

// Every booking (any status) starting in [from, to), for the admin calendar
export function ListBookingsBetween(from: string, to: string) {
  return (db.prepare(`SELECT ${COLUMNS} FROM bookings WHERE startsAt >= ? AND startsAt < ? ORDER BY startsAt`).all(from, to) as Booking[]).map(toBooking);
}

export function CountUpcomingBookings() {
  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM bookings WHERE status = 'confirmed' AND endsAt >= ?")
    .get(new Date().toISOString()) as { count: number };
  return count;
}

export function SetBookingStatus(id: number, status: BookingStatus) {
  return db.prepare('UPDATE bookings SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(status, id).changes;
}

export function LinkBookingToClient(id: number, clientId: number) {
  return db.prepare('UPDATE bookings SET clientId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(clientId, id).changes;
}
