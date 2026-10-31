"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { vatOverview } from "@/lib/finance";
import { formatDate, formatDateTime, formatPence } from "@/lib/format";
import PageHeader from "../../components/pageHeader";
import { api, showError, showSuccess } from "../../components/api";
import { Pill, smallButton } from "../../components/fields";
import { Disclaimer } from "../moneyNav";

type Overview = ReturnType<typeof vatOverview>;

export default function VatPage() {
  const [data, setData] = useState<Overview | null>(null);
  const load = useCallback(() => api<{ vat: Overview }>("/api/admin/finance/summary").then((d) => setData(d.vat)).catch(showError), []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className="text-mutedColour">Loading…</p>;
  const isIe = data.profile.country === "ie";

  if (!data.profile.registered) {
    return (
      <>
        <PageHeader title="VAT" description="You're not VAT registered." />
        <p className="card p-6 text-mutedColour">
          Your progress towards the registration threshold is on the <Link href="/admin/Money" className="text-accentColour underline">overview</Link>. Once you
          register, set your VAT number, start date and scheme in <Link href="/admin/Settings" className="text-accentColour underline">Settings → Tax and VAT</Link>:
          invoices will then add VAT automatically and your returns will appear here.
        </p>
        <Disclaimer />
      </>
    );
  }

  const mark = async (period: Overview["periods"][number], action: "submitted" | "undo") => {
    const reference = action === "submitted" ? window.prompt(`Filed the ${period.label} return? Add its reference (optional):`, "") : "";
    if (reference === null) return;
    try {
      await api("/api/admin/finance/vat", "PATCH", { start: period.start, end: period.end, action, reference });
      showSuccess(action === "submitted" ? "Marked as filed" : "Marked as not filed");
      await load();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <>
      <PageHeader
        title="VAT"
        description={`${isIe ? "VAT3 returns every two months, filed on ROS" : "Quarterly VAT returns, filed with Making Tax Digital software"}. Scheme: ${{ invoice: "standard", cash: "cash accounting", flat_rate: `Flat Rate Scheme at ${data.profile.flatRate}%` }[data.profile.scheme]}.`}
      />
      <div className="flex flex-col gap-4">
        {data.periods.map((period) => (
          <section key={period.start} className="card p-6" aria-label={`VAT ${period.label}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-FiraSans-Bold">{period.label}</h2>
                <p className="text-sm text-mutedColour">Due {formatDate(period.due)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {period.open ? <Pill tone="blue">In progress</Pill> : period.submitted ? <Pill tone="green">Filed {formatDateTime(period.submitted.at)}</Pill> : <Pill tone="amber">To file</Pill>}
                <span className={`text-lg font-FiraSans-Bold ${period.payable < 0 ? "text-successColour" : ""}`}>
                  {period.payable < 0 ? `Reclaim ${formatPence(-period.payable)}` : `Pay ${formatPence(period.payable)}`}
                </span>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
              {period.boxes.map((box) => (
                <div key={box.key} className="flex justify-between gap-3 border-b border-borderColour/50 py-1">
                  <dt className="text-mutedColour"><span className="font-mono text-textColour">{box.key}</span> {box.label}</dt>
                  <dd>{formatPence(box.amount)}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 text-xs text-mutedColour list-disc pl-5">{period.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`/api/admin/finance/export?kind=vat&start=${period.start}&end=${period.end}`} className={smallButton}>Download CSV</a>
              {!period.open && !period.submitted && <button type="button" className={smallButton} onClick={() => mark(period, "submitted")}>Mark as filed</button>}
              {period.submitted && <button type="button" className={smallButton} onClick={() => mark(period, "undo")}>Undo filed</button>}
            </div>
          </section>
        ))}
      </div>
      <Disclaimer />
    </>
  );
}
