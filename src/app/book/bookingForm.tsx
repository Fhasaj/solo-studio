"use client";

import { useMemo, useState } from "react";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import type { DaySlots } from "@/lib/booking";
import { addDays, weekday } from "@/lib/format";

interface BookingFormProps {
  days: DaySlots[];
  minutes: number;
  hasVideoLink: boolean;
  contactEmail: string;
}

const INDUSTRIES = ["Construction & trades", "Logistics & transport", "Security", "Other"];

const inputClass = "admin-input";

export default function BookingForm({ days: initialDays, minutes, hasVideoLink, contactEmail }: BookingFormProps) {
  const [days, setDays] = useState(initialDays);
  const [day, setDay] = useState(initialDays[0]?.day ?? "");
  const [start, setStart] = useState("");
  const [callType, setCallType] = useState<"phone" | "video">("phone");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<{ when: string; callType: string } | null>(null);

  const selectedDay = days.find((d) => d.day === day);
  const selectedSlot = selectedDay?.slots.find((slot) => slot.start === start);
  // Step 2 (details) once a time is picked; going back keeps anything already typed
  const step = selectedSlot ? 2 : 1;

  // Free days grouped into Monday-to-Sunday weeks, shown one week at a time
  const weeks = useMemo(() => {
    const starts = [...new Set(days.map((d) => addDays(d.day, -((weekday(d.day) + 6) % 7))))];
    return starts.map((monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }, [days]);
  const weekIndex = Math.max(0, weeks.findIndex((week) => week.includes(day)));
  const week = weeks[weekIndex] ?? [];
  const showWeek = (index: number) => {
    const firstFree = weeks[index]?.find((d) => days.some((free) => free.day === d));
    if (firstFree) {
      setDay(firstFree);
      setStart("");
    }
  };
  const weekLabel = week.length
    ? `${new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${week[0]}T12:00:00Z`))} – ${new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${week[6]}T12:00:00Z`))}`
    : "";

  const refresh = async () => {
    const res = await fetch("/api/bookings");
    const json = await res.json().catch(() => ({}));
    if (Array.isArray(json.data)) setDays(json.data);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError({ message: "Choose a time for the call first.", field: "start" });
      return;
    }
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(form), start, callType }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: json.error ?? "Something went wrong. Please try again.", field: json.field });
        if (res.status === 409) {
          setStart("");
          await refresh();
        }
        return;
      }
      setBooked({ when: `${selectedDay!.label} at ${selectedSlot.time}`, callType });
    } catch {
      setError({ message: "Something went wrong. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (booked) {
    return (
      <div className="card p-8 max-w-2xl" role="status">
        <h2 className="text-2xl font-FiraSans-ExtraBold text-textColour">You&apos;re booked in</h2>
        <p className="mt-3 text-lg text-mutedColour">
          {booked.when} (UK time). {booked.callType === "phone" ? "I'll ring you on the number you gave." : hasVideoLink ? "The video link is in your confirmation email." : "I'll email you a video link before the call."}
        </p>
        <p className="mt-3 text-mutedColour">A confirmation with a calendar invite is on its way to your inbox. Talk soon!</p>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <p className="card p-8 max-w-2xl text-mutedColour">
        There are no free times at the moment. Please email{" "}
        <a href={`mailto:${contactEmail}`} className="text-accentColour underline underline-offset-4">{contactEmail}</a> and I&apos;ll find a time that works.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl" noValidate>
      <ol className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Booking steps">
        {["Choose a time", "Your details"].map((label, index) => (
          <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={`flex items-center gap-2 ${step === index + 1 ? "text-textColour font-FiraSans-SemiBold" : "text-mutedColour"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step > index ? "bg-accentColour text-backgroundColour" : "border border-borderColour"}`} aria-hidden>
              {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <fieldset className="card p-6 min-w-0" hidden={step !== 1}>
        <legend className="sr-only">Choose a time</legend>
        <h2 className="text-xl font-FiraSans-Bold text-textColour">Choose a time</h2>
        <p className="mt-1 text-sm text-mutedColour">{minutes} minutes. All times are UK time.</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" aria-label="Previous week" disabled={weekIndex === 0} onClick={() => showWeek(weekIndex - 1)} className="rounded-md border border-borderColour p-1.5 text-xl hover:border-accentColour disabled:opacity-30">
            <MdChevronLeft />
          </button>
          <p className="text-sm font-FiraSans-SemiBold text-textColour" aria-live="polite">{weekLabel}</p>
          <button type="button" aria-label="Next week" disabled={weekIndex >= weeks.length - 1} onClick={() => showWeek(weekIndex + 1)} className="rounded-md border border-borderColour p-1.5 text-xl hover:border-accentColour disabled:opacity-30">
            <MdChevronRight />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1.5" role="group" aria-label="Day">
          {week.map((date) => {
            const free = days.find((d) => d.day === date);
            const [weekdayName, dayNumber] = [
              new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(new Date(`${date}T12:00:00Z`)),
              Number(date.slice(8)),
            ];
            return (
              <button
                key={date}
                type="button"
                disabled={!free}
                aria-pressed={date === day}
                aria-label={free ? free.label : `${weekdayName} ${dayNumber}: no free times`}
                onClick={() => {
                  setDay(date);
                  setStart("");
                }}
                className={`flex flex-col items-center rounded-lg border py-2 text-sm ${
                  date === day
                    ? "border-accentColour bg-accentColour/15 text-accentColour"
                    : free
                      ? "border-borderColour text-textColour hover:border-accentColour"
                      : "border-transparent text-mutedColour/40 cursor-not-allowed"
                }`}
              >
                <span className="text-xs uppercase">{weekdayName}</span>
                <span className="text-lg font-FiraSans-Bold">{dayNumber}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-sm text-mutedColour">{selectedDay ? `Free times on ${selectedDay.label}` : ""}</p>
        <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2" role="group" aria-label={`Times on ${selectedDay?.label ?? ""}`}>
          {selectedDay?.slots.map((slot) => (
            <button
              key={slot.start}
              type="button"
              aria-pressed={slot.start === start}
              onClick={() => setStart(slot.start)}
              className={`rounded-lg border px-3 py-2 text-sm ${slot.start === start ? "border-accentColour bg-accentColour text-backgroundColour font-FiraSans-Bold" : "border-borderColour text-textColour hover:border-accentColour"}`}
            >
              {slot.time}
            </button>
          ))}
        </div>
        {error?.field === "start" && <p className="mt-3 text-sm text-errorColour" role="alert">{error.message}</p>}
      </fieldset>

      <div className="card p-6 flex flex-col gap-4" hidden={step !== 2}>
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-accentColour/40 bg-accentColour/10 p-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-mutedColour">Your call</p>
            <p className="font-FiraSans-Bold text-textColour">
              {selectedDay?.label} at {selectedSlot?.time} <span className="font-FiraSans-Regular text-mutedColour">(UK time, {minutes} minutes)</span>
            </p>
          </div>
          <button type="button" onClick={() => setStart("")} className="text-sm text-accentColour underline underline-offset-4">
            Change time
          </button>
        </div>

        <h2 className="text-xl font-FiraSans-Bold text-textColour">Your details</h2>

        <fieldset>
          <legend className="mb-2 text-sm font-FiraSans-SemiBold text-textColour">How should we talk?</legend>
          <div className="flex flex-wrap gap-3">
            {(["phone", "video"] as const).map((type) => (
              <label key={type} className={`flex items-center gap-2 rounded-lg border px-4 py-2 cursor-pointer ${callType === type ? "border-accentColour" : "border-borderColour"}`}>
                <input type="radio" name="callTypeChoice" value={type} checked={callType === type} onChange={() => setCallType(type)} className="accent-accentColour" />
                {type === "phone" ? "Phone call (I'll ring you)" : "Video call"}
              </label>
            ))}
          </div>
        </fieldset>

        <Field id="name" label="Your name" required autoComplete="name" error={error} />
        <Field id="email" label="Email" type="email" required autoComplete="email" error={error} />
        <Field id="phone" label={callType === "phone" ? "Phone number" : "Phone number (optional)"} type="tel" required={callType === "phone"} autoComplete="tel" error={error} />
        <Field id="company" label="Business name (optional)" autoComplete="organization" error={error} />

        <div>
          <label htmlFor="industry" className="block mb-1 text-sm font-FiraSans-SemiBold text-textColour">Industry</label>
          <select id="industry" name="industry" className={inputClass} defaultValue="">
            <option value="">Choose one (optional)</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="message" className="block mb-1 text-sm font-FiraSans-SemiBold text-textColour">What would you like to talk about? (optional)</label>
          <textarea id="message" name="message" rows={4} maxLength={3000} className={inputClass} placeholder="e.g. We track jobs and timesheets in spreadsheets and it's getting out of hand." />
        </div>

        {/* Hidden from people; bots fill it in and are ignored */}
        <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

        {error && error.field !== "start" && !["name", "email", "phone", "company"].includes(error.field ?? "") && (
          <p className="text-sm text-errorColour" role="alert">{error.message}</p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
          {submitting ? "Booking…" : selectedSlot ? `Book ${selectedDay!.label} at ${selectedSlot.time}` : "Book the call"}
        </button>
        <p className="text-xs text-mutedColour">
          I&apos;ll only use your details to arrange and follow up this call. See the <a href="/privacy" className="underline underline-offset-2">privacy notice</a>.
        </p>
      </div>
    </form>
  );
}

function Field({ id, label, type = "text", required = false, autoComplete, error }: { id: string; label: string; type?: string; required?: boolean; autoComplete?: string; error: { message: string; field?: string } | null }) {
  const hasError = error?.field === id;
  return (
    <div>
      <label htmlFor={id} className="block mb-1 text-sm font-FiraSans-SemiBold text-textColour">
        {label}
        {required && <span className="text-errorColour" aria-hidden> *</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${id}-error` : undefined}
        className="admin-input"
      />
      {hasError && <p id={`${id}-error`} className="mt-1 text-sm text-errorColour" role="alert">{error.message}</p>}
    </div>
  );
}
