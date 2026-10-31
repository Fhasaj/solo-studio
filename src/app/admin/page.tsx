"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MdOutlineRateReview,
  MdOutlineDesignServices,
  MdOutlineFolder,
  MdOutlineWork,
  MdOutlineCalendarMonth,
  MdOutlinePayments,
} from "react-icons/md";
import type { WorkBoard } from "@/lib/portal";
import type { Booking } from "@/lib/query/bookings.query";
import { formatDate, formatDateTime, formatPence } from "@/lib/format";
import PageHeader from "./components/pageHeader";
import { api, showError } from "./components/api";

interface Summary {
  upcomingBookings: number;
  activeProjects: number;
  awaitingPayment: number;
  paymentsReported: number;
  supportRequests: number;
  caseStudies: { published: number; total: number };
  services: { visible: number; total: number };
  testimonials: { visible: number; total: number };
  board: WorkBoard;
  nextCalls: Booking[];
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api<Summary>("/api/admin/summary").then(setSummary).catch(showError);
  }, []);

  const value = (n: number | undefined) => (summary ? n : "…");

  const work = [
    { label: "Upcoming calls", href: "/admin/Bookings", icon: MdOutlineCalendarMonth, value: value(summary?.upcomingBookings), note: "Booked through /book" },
    { label: "Active jobs", href: "/admin/Jobs", icon: MdOutlineWork, value: value(summary?.activeProjects), note: summary?.supportRequests ? `${summary.supportRequests} new support request(s)` : "Planning, in progress or on hold" },
    {
      label: "Payments due",
      href: "/admin/Jobs",
      icon: MdOutlinePayments,
      value: value(summary?.awaitingPayment),
      note: summary?.paymentsReported ? `${summary.paymentsReported} marked as sent by the client: check your bank` : "Requested, not yet confirmed",
    },
  ];

  const content = [
    { label: "Case studies", href: "/admin/CaseStudies", icon: MdOutlineFolder, count: summary && `${summary.caseStudies.published} published of ${summary.caseStudies.total}` },
    { label: "Services", href: "/admin/Services", icon: MdOutlineDesignServices, count: summary && `${summary.services.visible} visible of ${summary.services.total}` },
    { label: "Testimonials", href: "/admin/Testimonals", icon: MdOutlineRateReview, count: summary && `${summary.testimonials.visible} published of ${summary.testimonials.total}` },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Your calls, jobs and payments at a glance." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {work.map(({ label, href, icon: Icon, value, note }) => (
          <Link key={label} href={href} className="card p-6 group hover:border-accentColour/60">
            <div className="flex items-center justify-between">
              <p className="font-FiraSans-Bold text-textColour group-hover:text-accentColour">{label}</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accentColour/10 text-xl text-accentColour"><Icon /></span>
            </div>
            <p className="mt-4 text-4xl font-FiraSans-ExtraBold text-textColour">{value}</p>
            <p className="mt-1 text-sm text-mutedColour">{note}</p>
          </Link>
        ))}
      </div>

      {summary && <Board board={summary.board} nextCalls={summary.nextCalls} />}

      <div className="mt-10 mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-FiraSans-Bold text-textColour">Site content</h2>
        <Link href="/admin/Settings" className="text-sm text-accentColour hover:underline">Show or hide sections in Settings</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {content.map(({ label, href, icon: Icon, count }) => (
          <Link key={label} href={href} className="card p-5 flex items-center justify-between gap-4 group hover:border-accentColour/60">
            <div>
              <p className="font-FiraSans-Bold text-textColour group-hover:text-accentColour">{label}</p>
              <p className="text-sm text-mutedColour">{count || "…"}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accentColour/10 text-xl text-accentColour"><Icon /></span>
          </Link>
        ))}
      </div>
    </>
  );
}

// ---- Work board ----

function Column({ title, empty, tone, children, count }: { title: string; empty: string; tone: string; count: number; children: React.ReactNode }) {
  return (
    <section className="card p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-FiraSans-Bold text-textColour">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-md border ${tone}`}>{count}</span>
      </div>
      {count === 0 ? <p className="mt-3 text-sm text-mutedColour">{empty}</p> : <ul className="mt-3 flex flex-col gap-2">{children}</ul>}
    </section>
  );
}

function Item({ href, title, detail, highlight }: { href: string; title: string; detail: string; highlight?: string }) {
  return (
    <li>
      <Link href={href} className="block rounded-lg border border-borderColour bg-backgroundColour p-3 hover:border-accentColour">
        <p className="text-sm font-FiraSans-SemiBold text-textColour">{title}</p>
        <p className="text-xs text-mutedColour">{detail}</p>
        {highlight && <p className="mt-1 text-xs text-warningColour">{highlight}</p>}
      </Link>
    </li>
  );
}

const TONE = {
  blue: "border-accentColour/40 text-accentColour",
  amber: "border-warningColour/40 text-warningColour",
  grey: "border-borderColour text-mutedColour",
};

function Board({ board, nextCalls }: { board: WorkBoard; nextCalls: Booking[] }) {
  const job = (id: number) => `/admin/Jobs/${id}`;
  return (
    <>
      <h2 className="mt-10 mb-4 text-xl font-FiraSans-Bold text-textColour">Work board</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Column title="Next calls" empty="No calls booked." tone={TONE.blue} count={nextCalls.length}>
          {nextCalls.map((call) => (
            <Item
              key={call.id}
              href="/admin/Bookings"
              title={formatDateTime(call.startsAt)}
              detail={`${call.name}${call.company ? `, ${call.company}` : ""} · ${call.callType === "phone" ? `ring ${call.phone}` : "video"}`}
            />
          ))}
        </Column>

        <Column title="Being worked on" empty="Nothing in progress." tone={TONE.blue} count={board.inProgress.length}>
          {board.inProgress.map((m) => (
            <Item key={m.id} href={job(m.projectId)} title={m.title} detail={`${m.projectTitle} · ${m.clientName}`} />
          ))}
        </Column>

        <Column title="Ready to start" empty="Nothing waiting to start." tone={TONE.blue} count={board.readyToStart.length}>
          {board.readyToStart.map((m) => (
            <Item
              key={m.id}
              href={job(m.projectId)}
              title={m.title}
              detail={`${m.projectTitle} · ${m.clientName}`}
              highlight={m.needsPayment ? `Request ${formatPence(m.amount)} before starting` : undefined}
            />
          ))}
        </Column>

        <Column title="Waiting for payment" empty="Nobody owes you anything." tone={TONE.amber} count={board.awaitingPayment.length}>
          {board.awaitingPayment.map((m) => (
            <Item
              key={m.id}
              href={job(m.projectId)}
              title={`${formatPence(m.amount)} · ${m.clientName}`}
              detail={`${m.title} · ${m.projectTitle} · ref ${m.reference}${m.requestedAt ? ` · requested ${formatDate(m.requestedAt)}` : ""}`}
              highlight={m.reportedAt ? "Client says it's paid: check your bank and confirm" : m.overdue ? "Overdue (more than 14 days)" : undefined}
            />
          ))}
        </Column>

        <Column title="Waiting for a contract" empty="All active jobs have a signed contract." tone={TONE.grey} count={board.waitingForContract.length}>
          {board.waitingForContract.map((p) => (
            <Item
              key={p.projectId}
              href={job(p.projectId)}
              title={p.projectTitle}
              detail={p.clientName}
              highlight={p.contractSent ? "Sent, waiting for their signature" : "Contract not sent yet"}
            />
          ))}
        </Column>

        <Column title="Hosting due" empty="No hosting renewals in the next 14 days." tone={TONE.amber} count={board.hostingDue.length}>
          {board.hostingDue.map((h) => (
            <Item
              key={h.projectId}
              href={job(h.projectId)}
              title={`${formatPence(h.amount)}/month · ${h.clientName}`}
              detail={h.projectTitle}
              highlight={h.paidUntil ? `Paid until ${formatDate(h.paidUntil)}` : "No hosting payment recorded yet"}
            />
          ))}
        </Column>
      </div>
    </>
  );
}
