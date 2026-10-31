"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import type { Booking, BookingStatus } from "@/lib/query/bookings.query";
import { parseHours, type SiteSettings } from "@/lib/siteSettings";
import { addDays, formatDateTime, formatTime, londonDay, weekday } from "@/lib/format";
import PageHeader from "../components/pageHeader";
import { api, showError, showSuccess } from "../components/api";
import { dangerButton, Pill, smallButton } from "../components/fields";

const STATUS: Record<BookingStatus, [string, "blue" | "grey" | "green" | "red"]> = {
  confirmed: ["Booked", "blue"],
  completed: ["Done", "green"],
  no_show: ["No-show", "red"],
  cancelled: ["Cancelled", "grey"],
};

const HOURS_KEYS = ["bookingHoursSun", "bookingHoursMon", "bookingHoursTue", "bookingHoursWed", "bookingHoursThu", "bookingHoursFri", "bookingHoursSat"] as const;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function BookingsPage() {
  // Bumped after any change, so the calendar and the lists stay in step
  const [version, setVersion] = useState(0);
  const [showPast, setShowPast] = useState(false);
  const changed = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <>
      <PageHeader title="Bookings" description="Calls booked through /book. Set your available hours under Settings → Booking calls." />

      <CalendarView version={version} onChange={changed} />

      <h2 className="mt-10 mb-4 text-xl font-FiraSans-Bold text-textColour">Upcoming calls</h2>
      <ListView scope="upcoming" version={version} onChange={changed} />

      <div className="mt-10">
        <button type="button" className={smallButton} aria-expanded={showPast} onClick={() => setShowPast((v) => !v)}>
          {showPast ? "Hide past calls" : "Show past calls"}
        </button>
        {showPast && (
          <div className="mt-4">
            <ListView scope="past" version={version} onChange={changed} />
          </div>
        )}
      </div>
    </>
  );
}

// ---- Shared booking card and actions ----

function useBookingActions(reload: () => unknown) {
  const router = useRouter();

  const setStatus = async (booking: Booking, status: BookingStatus) => {
    if (status === "cancelled" && !window.confirm(`Cancel the call with ${booking.name}? Let them know yourself; no email is sent.`)) return;
    try {
      await api("/api/admin/bookings", "PATCH", { id: booking.id, status });
      await reload();
    } catch (error) {
      showError(error);
    }
  };

  const makeClient = async (booking: Booking) => {
    try {
      const { id } = await api<{ id: number }>("/api/admin/clients", "POST", {
        name: booking.name,
        email: booking.email,
        company: booking.company,
        phone: booking.phone,
        notes: [booking.industry && `Industry: ${booking.industry}`, booking.message && `From their booking: ${booking.message}`].filter(Boolean).join("\n\n"),
        bookingId: booking.id,
      });
      showSuccess("Client created");
      router.push(`/admin/Clients/${id}`);
    } catch (error) {
      showError(error);
    }
  };

  return { setStatus, makeClient };
}

function BookingCard({ booking, actions, now, showDate = true }: { booking: Booking; actions: ReturnType<typeof useBookingActions>; now: number; showDate?: boolean }) {
  const [label, tone] = STATUS[booking.status];
  const isPast = Date.parse(booking.endsAt) < now;
  return (
    <li className={`card p-5 ${booking.status === "cancelled" ? "opacity-60" : ""}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="font-FiraSans-Bold text-textColour">{showDate ? formatDateTime(booking.startsAt) : `${formatTime(booking.startsAt)}–${formatTime(booking.endsAt)}`}</p>
          <p className="text-textColour">
            {booking.name}
            {booking.company && <span className="text-mutedColour"> · {booking.company}</span>}
            {booking.industry && <span className="text-mutedColour"> · {booking.industry}</span>}
          </p>
          <p className="text-sm text-mutedColour">
            {booking.callType === "phone" ? "Phone call" : "Video call"}
            {booking.phone && (
              <>
                {" · "}
                <a href={`tel:${booking.phone.replace(/[^+\d]/g, "")}`} className="hover:text-accentColour">{booking.phone}</a>
              </>
            )}
            {" · "}
            <a href={`mailto:${booking.email}`} className="hover:text-accentColour">{booking.email}</a>
          </p>
        </div>
        <Pill tone={tone}>{label}</Pill>
      </div>
      {booking.message && <p className="mt-3 text-sm text-mutedColour whitespace-pre-line">{booking.message}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {booking.status !== "completed" && booking.status !== "cancelled" && (
          <button type="button" className={smallButton} onClick={() => actions.setStatus(booking, "completed")}>Mark done</button>
        )}
        {isPast && booking.status === "confirmed" && (
          <button type="button" className={smallButton} onClick={() => actions.setStatus(booking, "no_show")}>No-show</button>
        )}
        {booking.clientId ? (
          <Link href={`/admin/Clients/${booking.clientId}`} className={smallButton}>View client</Link>
        ) : (
          booking.status !== "cancelled" && <button type="button" className={smallButton} onClick={() => actions.makeClient(booking)}>Make them a client</button>
        )}
        {booking.status === "confirmed" && !isPast && (
          <button type="button" className={`${dangerButton} ml-auto`} onClick={() => actions.setStatus(booking, "cancelled")}>Cancel</button>
        )}
      </div>
    </li>
  );
}

// ---- List ----

function ListView({ scope, version, onChange }: { scope: "upcoming" | "past"; version: number; onChange: () => void }) {
  const [items, setItems] = useState<Booking[] | null>(null);
  // version is a dependency so the list reloads when the calendar changes something
  const load = useCallback(() => api<Booking[]>(`/api/admin/bookings?scope=${scope}&v=${version}`).then(setItems).catch(showError), [scope, version]);
  const actions = useBookingActions(onChange);
  // Read once when the view opens, so rendering stays pure
  const [now] = useState(() => Date.now());

  useEffect(() => {
    load();
  }, [load]);

  // Upcoming calls are grouped by day so the week ahead is easy to scan
  const groups = useMemo(() => {
    const byDay = new Map<string, Booking[]>();
    for (const booking of items ?? []) {
      const day = londonDay(new Date(booking.startsAt));
      byDay.set(day, [...(byDay.get(day) ?? []), booking]);
    }
    return [...byDay.entries()];
  }, [items]);

  if (items === null) return <p className="text-mutedColour">Loading…</p>;
  if (items.length === 0) return <p className="card p-6 text-mutedColour">{scope === "upcoming" ? "No calls booked yet." : "No past calls."}</p>;

  if (scope === "past") {
    return (
      <ul className="flex flex-col gap-3">
        {items.map((booking) => (
          <BookingCard key={booking.id} booking={booking} actions={actions} now={now} />
        ))}
      </ul>
    );
  }

  const today = londonDay(new Date(now));
  return (
    <div className="flex flex-col gap-8">
      {groups.map(([day, bookings]) => (
        <section key={day}>
          <h2 className="mb-3 text-sm uppercase tracking-wider text-mutedColour font-FiraSans-SemiBold">
            {day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : dayHeading(day)}
          </h2>
          <ul className="flex flex-col gap-3">
            {bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} actions={actions} now={now} showDate={false} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function dayHeading(day: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));
}

// ---- Calendar ----

function monthGrid(month: string) {
  const first = `${month}-01`;
  // Weeks start on Monday
  const start = addDays(first, -((weekday(first) + 6) % 7));
  const days: string[] = [];
  for (let day = start; days.length < 42; day = addDays(day, 1)) days.push(day);
  // Drop a trailing week that's entirely next month
  return days.slice(0, days[35].slice(0, 7) !== month ? 35 : 42);
}

function CalendarView({ version, onChange }: { version: number; onChange: () => void }) {
  const [today] = useState(() => londonDay(new Date()));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const days = useMemo(() => monthGrid(month), [month]);

  const load = useCallback(
    () => api<Booking[]>(`/api/admin/bookings?from=${days[0]}&to=${addDays(days[days.length - 1], 1)}&v=${version}`).then(setBookings).catch(showError),
    [days, version]
  );
  const actions = useBookingActions(onChange);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<SiteSettings>("/api/admin/settings").then(setSettings).catch(showError);
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of bookings ?? []) {
      const day = londonDay(new Date(booking.startsAt));
      map.set(day, [...(map.get(day) ?? []), booking]);
    }
    return map;
  }, [bookings]);

  const blocked = useMemo(() => new Set((settings?.bookingBlockedDates ?? "").split("\n").map((d) => d.trim()).filter(Boolean)), [settings]);
  const hasHours = (day: string) => {
    try {
      return settings ? parseHours(settings[HOURS_KEYS[weekday(day)]]).length > 0 : true;
    } catch {
      return false;
    }
  };

  const shiftMonth = (offset: number) => {
    const [year, m] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year, m - 1 + offset, 1)).toISOString().slice(0, 7);
    setBookings(null);
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
  };

  const toggleBlocked = async (day: string) => {
    const next = new Set(blocked);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    try {
      const data = await api<SiteSettings>("/api/admin/settings", "PUT", { values: { bookingBlockedDates: [...next].sort().join("\n") } });
      setSettings(data);
      showSuccess(next.has(day) ? "Day blocked: no new calls can be booked" : "Day opened for bookings");
    } catch (error) {
      showError(error);
    }
  };

  const monthLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}-15T12:00:00Z`));
  const selectedBookings = byDay.get(selected) ?? [];

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[1fr_420px] gap-6 items-start">
      <section className="card p-4 md:p-6" aria-label="Calendar">
        <div className="flex items-center justify-between gap-3">
          <button type="button" aria-label="Previous month" className={`${smallButton} p-1.5!`} onClick={() => shiftMonth(-1)}><MdChevronLeft className="text-xl" /></button>
          <h2 className="text-lg font-FiraSans-Bold">{monthLabel}</h2>
          <button type="button" aria-label="Next month" className={`${smallButton} p-1.5!`} onClick={() => shiftMonth(1)}><MdChevronRight className="text-xl" /></button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wider text-mutedColour" aria-hidden>
          {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1" role="grid">
          {days.map((day) => {
            const calls = (byDay.get(day) ?? []).filter((b) => b.status !== "cancelled");
            const inMonth = day.slice(0, 7) === month;
            const closed = blocked.has(day) || !hasHours(day);
            return (
              <button
                key={day}
                type="button"
                role="gridcell"
                aria-selected={day === selected}
                aria-label={`${dayHeading(day)}: ${calls.length} call${calls.length === 1 ? "" : "s"}${blocked.has(day) ? ", blocked" : ""}`}
                onClick={() => setSelected(day)}
                className={`min-h-20 md:min-h-24 rounded-lg border p-1.5 text-left align-top flex flex-col gap-1 ${
                  day === selected ? "border-accentColour" : "border-borderColour"
                } ${closed ? "border-dashed bg-transparent" : "bg-backgroundColour"} ${!inMonth ? "opacity-30" : closed ? "opacity-60" : ""}`}
              >
                <span className={`self-start text-xs font-FiraSans-SemiBold ${day === today ? "rounded-full bg-accentColour text-backgroundColour px-1.5" : "text-mutedColour"}`}>
                  {Number(day.slice(8))}
                </span>
                {blocked.has(day) && <span className="text-[10px] text-errorColour">Blocked</span>}
                {calls.slice(0, 3).map((call) => (
                  <span key={call.id} className={`truncate rounded px-1 text-[11px] ${call.status === "confirmed" ? "bg-accentColour/15 text-accentColour" : "bg-successColour/10 text-successColour"}`}>
                    {formatTime(call.startsAt)} {call.name.split(" ")[0]}
                  </span>
                ))}
                {calls.length > 3 && <span className="text-[10px] text-mutedColour">+{calls.length - 3} more</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-mutedColour">Dashed days have no booking hours or are blocked. Times are UK time.</p>
      </section>

      <section aria-labelledby="day-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 id="day-heading" className="text-lg font-FiraSans-Bold">{dayHeading(selected)}</h2>
          {selected >= today && settings && (
            <button type="button" className={blocked.has(selected) ? smallButton : dangerButton} onClick={() => toggleBlocked(selected)}>
              {blocked.has(selected) ? "Open for bookings" : "Block this day"}
            </button>
          )}
        </div>
        {bookings === null ? (
          <p className="text-mutedColour">Loading…</p>
        ) : selectedBookings.length === 0 ? (
          <p className="card p-5 text-mutedColour">No calls on this day.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {selectedBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} actions={actions} now={now} showDate={false} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
