"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MdAdd,
  MdOutlineAccountBalanceWallet,
  MdOutlineCalendarMonth,
  MdOutlineDesignServices,
  MdOutlineFolder,
  MdOutlineRateReview,
  MdOutlineReceiptLong,
  MdOutlineSavings,
  MdOutlineTrendingUp,
  MdOutlineUploadFile,
  MdOutlineWork,
} from "react-icons/md";
import type { WorkBoard } from "@/lib/portal";
import type { Booking } from "@/lib/query/bookings.query";
import type { Activity, Attention } from "@/lib/dashboard";
import { formatDate, formatDateTime, formatPence } from "@/lib/format";
import { api, showError } from "./components/api";

interface Summary {
  upcomingBookings: number;
  activeProjects: number;
  caseStudies: { published: number; total: number };
  services: { visible: number; total: number };
  testimonials: { visible: number; total: number };
  board: WorkBoard;
  nextCalls: Booking[];
  finance: { yearLabel: string; turnover: number; profit: number; estimatedTax: number; setAsidePercent: number };
  outstanding: { count: number; total: number };
  attention: Attention[];
  activity: Activity[];
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

const TONE_DOT = { red: "bg-errorColour", amber: "bg-warningColour", blue: "bg-accentColour" };

const QUICK_ACTIONS = [
  { href: "/admin/Jobs", label: "New job", icon: MdOutlineWork },
  { href: "/admin/Clients", label: "New client", icon: MdAdd },
  { href: "/admin/Money/Expenses", label: "Add expense", icon: MdOutlineReceiptLong },
  { href: "/admin/Money/Bank", label: "Upload statement", icon: MdOutlineUploadFile },
  { href: "/admin/CaseStudies/new", label: "New case study", icon: MdOutlineFolder },
];

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    api<Summary>("/api/admin/summary").then(setSummary).catch(showError);
    api<{ ownerName: string }>("/api/admin/settings").then((s) => setName(s.ownerName.split(" ")[0] ?? "")).catch(() => {});
  }, []);

  const kpis = summary
    ? [
        { label: `Income ${summary.finance.yearLabel}`, value: formatPence(summary.finance.turnover), note: `Profit ${formatPence(summary.finance.profit)}`, icon: MdOutlineTrendingUp, href: "/admin/Money" },
        { label: "Unpaid invoices", value: formatPence(summary.outstanding.total), note: `${summary.outstanding.count} invoice${summary.outstanding.count === 1 ? "" : "s"}`, icon: MdOutlineAccountBalanceWallet, href: "/admin/Jobs" },
        { label: "Tax to set aside", value: formatPence(summary.finance.estimatedTax), note: `About ${summary.finance.setAsidePercent}% of what comes in`, icon: MdOutlineSavings, href: "/admin/Money" },
        { label: "Upcoming calls", value: String(summary.upcomingBookings), note: `${summary.activeProjects} active job${summary.activeProjects === 1 ? "" : "s"}`, icon: MdOutlineCalendarMonth, href: "/admin/Bookings" },
      ]
    : [];

  return (
    <>
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-sm text-mutedColour">{formatDate(new Date())}</p>
          <h1 className="mt-1 text-3xl font-FiraSans-ExtraBold text-textColour">{greeting()}{name ? `, ${name}` : ""}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
            <Link key={label} href={href} className="inline-flex items-center gap-2 rounded-lg border border-borderColour bg-secondaryColour px-3 py-2 text-sm text-textColour hover:border-accentColour hover:text-accentColour">
              <Icon className="text-base" aria-hidden /> {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {(summary ? kpis : Array.from({ length: 4 }, () => null)).map((kpi, index) =>
          kpi ? (
            <Link key={kpi.label} href={kpi.href} className="card p-5 group hover:border-accentColour/60">
              <div className="flex items-center justify-between">
                <p className="text-sm text-mutedColour">{kpi.label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accentColour/10 text-lg text-accentColour"><kpi.icon /></span>
              </div>
              <p className="mt-3 text-3xl font-FiraSans-ExtraBold text-textColour">{kpi.value}</p>
              <p className="mt-1 text-xs text-mutedColour">{kpi.note}</p>
            </Link>
          ) : (
            <div key={index} className="card p-5 h-[124px] animate-pulse" aria-hidden />
          )
        )}
      </div>

      {summary && (
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <section className="card p-6 xl:col-span-2" aria-labelledby="attention-heading">
            <h2 id="attention-heading" className="text-lg font-FiraSans-Bold">Needs your attention</h2>
            {summary.attention.length === 0 ? (
              <p className="mt-3 text-sm text-mutedColour">All clear. Nothing needs you right now.</p>
            ) : (
              <ul className="mt-3 divide-y divide-borderColour">
                {summary.attention.map((item) => (
                  <li key={item.text}>
                    <Link href={item.href} className="flex items-center gap-3 py-3 text-sm hover:text-accentColour">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[item.tone]}`} aria-hidden />
                      <span className="flex-1">{item.text}</span>
                      <span aria-hidden className="text-mutedColour">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-6" aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="text-lg font-FiraSans-Bold">Recent activity</h2>
            {summary.activity.length === 0 ? (
              <p className="mt-3 text-sm text-mutedColour">Nothing yet.</p>
            ) : (
              <ol className="mt-3 relative border-l border-borderColour ml-1.5">
                {summary.activity.map((item) => (
                  <li key={item.at + item.text} className="mb-4 last:mb-0 pl-4 relative">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-accentColour/70 ring-4 ring-secondaryColour" aria-hidden />
                    <Link href={item.href} className="text-sm text-textColour hover:text-accentColour">{item.text}</Link>
                    <p className="text-xs text-mutedColour">{formatDateTime(item.at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {summary && <Board board={summary.board} nextCalls={summary.nextCalls} />}

      {summary && (
        <>
          <h2 className="mt-10 mb-4 text-xl font-FiraSans-Bold text-textColour">Website</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Case studies", href: "/admin/CaseStudies", icon: MdOutlineFolder, count: `${summary.caseStudies.published} published of ${summary.caseStudies.total}` },
              { label: "Services", href: "/admin/Services", icon: MdOutlineDesignServices, count: `${summary.services.visible} visible of ${summary.services.total}` },
              { label: "Testimonials", href: "/admin/Testimonals", icon: MdOutlineRateReview, count: `${summary.testimonials.visible} published of ${summary.testimonials.total}` },
            ].map(({ label, href, icon: Icon, count }) => (
              <Link key={label} href={href} className="card p-5 flex items-center justify-between gap-4 group hover:border-accentColour/60">
                <div>
                  <p className="font-FiraSans-Bold text-textColour group-hover:text-accentColour">{label}</p>
                  <p className="text-sm text-mutedColour">{count}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accentColour/10 text-xl text-accentColour"><Icon /></span>
              </Link>
            ))}
          </div>
        </>
      )}
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
