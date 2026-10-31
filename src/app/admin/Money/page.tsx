"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { financeYear, vatOverview, vatThreshold } from "@/lib/finance";
import { formatDate, formatPence } from "@/lib/format";
import PageHeader from "../components/pageHeader";
import { api, showError } from "../components/api";
import { Pill, smallButton } from "../components/fields";
import { Disclaimer } from "./moneyNav";

type Summary = ReturnType<typeof financeYear> & { vatThreshold: ReturnType<typeof vatThreshold>; vat: ReturnType<typeof vatOverview> };

// "2026/27" → ["2026/27", "2025/26", "2024/25"]; "2026" → ["2026", "2025", "2024"]
function recentYears(current: string) {
  const start = Number(current.slice(0, 4));
  return [0, 1, 2].map((back) => (current.includes("/") ? `${start - back}/${String((start - back + 1) % 100).padStart(2, "0")}` : String(start - back)));
}

export default function MoneyOverview() {
  const [year, setYear] = useState<string | null>(null);
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    api<Summary>(`/api/admin/finance/summary${year ? `?year=${encodeURIComponent(year)}` : ""}`).then(setData).catch(showError);
  }, [year]);

  if (!data) return <p className="text-mutedColour">Loading…</p>;
  const pounds = (amount: number) => formatPence(Math.round(amount * 100));
  const isIe = data.country === "ie";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Money" description={`Tax year ${data.year.label} (${formatDate(data.year.start)} to ${formatDate(data.year.end)}). Income counts when it's paid.`} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <label htmlFor="year" className="text-sm text-mutedColour">Tax year</label>
        <select id="year" value={data.year.label} onChange={(e) => setYear(e.target.value)} className="admin-input w-auto! py-2!">
          {recentYears(data.current.label).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <a href={`/api/admin/finance/export?kind=transactions&year=${encodeURIComponent(data.year.label)}`} className={smallButton}>Download all transactions (CSV)</a>
      </div>

      {data.ratesFallback && (
        <p className="mb-6 card p-4 border-warningColour/50 text-warningColour text-sm">
          There are no tax rates for {data.year.label} yet, so last year&apos;s are used. <Link href="/admin/Money/Rates" className="underline">Check the rates</Link>.
        </p>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          ["Income", formatPence(data.income.turnover), ""],
          ["Expenses", formatPence(data.deductions), data.useTradingAllowance ? "Using the £1,000 trading allowance" : ""],
          ["Profit", formatPence(data.profit), ""],
          ["Estimated tax", pounds(data.estimate.total), `${data.estimate.effectiveRate.toFixed(1)}% of profit`],
          ["Set aside", `${data.setAsidePercent}%`, "of each payment you receive"],
        ].map(([label, value, note]) => (
          <div key={label} className="card p-5">
            <p className="text-xs uppercase tracking-wider text-mutedColour">{label}</p>
            <p className="mt-2 text-2xl font-FiraSans-ExtraBold text-textColour">{value}</p>
            {note && <p className="mt-1 text-xs text-mutedColour">{note}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <section className="card p-6" aria-labelledby="estimate-heading">
          <h2 id="estimate-heading" className="text-lg font-FiraSans-Bold">Tax estimate</h2>
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-2 text-sm">
            <dt className="text-mutedColour">Income tax{Number(data.estimate.profit) ? " (on your business profit)" : ""}</dt>
            <dd className="text-right">{pounds(data.estimate.incomeTax)}</dd>
            {isIe && (
              <>
                <dt className="text-mutedColour">USC</dt>
                <dd className="text-right">{pounds(data.estimate.usc)}</dd>
              </>
            )}
            <dt className="text-mutedColour">{data.estimate.socialInsuranceLabel}</dt>
            <dd className="text-right">{pounds(data.estimate.socialInsurance)}</dd>
            <dt className="font-FiraSans-Bold border-t border-borderColour pt-2">Total</dt>
            <dd className="text-right font-FiraSans-Bold border-t border-borderColour pt-2">{pounds(data.estimate.total)}</dd>
          </dl>
          <ul className="mt-4 space-y-1 text-xs text-mutedColour list-disc pl-5">
            {data.estimate.notes.map((note) => <li key={note}>{note}</li>)}
            <li>Other income (e.g. a salary) is set under <Link href="/admin/Settings" className="underline">Settings → Tax and VAT</Link>.</li>
          </ul>

          <h3 className="mt-6 font-FiraSans-SemiBold">Expenses by category</h3>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            {data.categories.filter((c) => c.amount).map((c) => (
              <div key={c.key} className="contents">
                <dt className={c.allowable ? "text-mutedColour" : "text-mutedColour line-through"}>{c.label}</dt>
                <dd className="text-right">{formatPence(c.amount)}</dd>
              </div>
            ))}
            {data.mileageTotal > 0 && (
              <>
                <dt className="text-mutedColour">Mileage</dt>
                <dd className="text-right">{formatPence(data.mileageTotal)}</dd>
              </>
            )}
            {data.homeOffice > 0 && (
              <>
                <dt className="text-mutedColour">Working from home (flat rate)</dt>
                <dd className="text-right">{formatPence(data.homeOffice)}</dd>
              </>
            )}
            {!data.categories.some((c) => c.amount) && !data.mileageTotal && !data.homeOffice && <dt className="text-mutedColour">No expenses recorded yet.</dt>}
          </dl>
        </section>

        <div className="flex flex-col gap-6">
          <section className="card p-6" aria-labelledby="deadlines-heading">
            <h2 id="deadlines-heading" className="text-lg font-FiraSans-Bold">Deadlines</h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {[...data.deadlines, ...data.quarters.map((q) => ({ date: q.due, label: `Making Tax Digital update for quarter ${q.number}` }))]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((d) => (
                  <li key={d.date + d.label} className={`flex justify-between gap-4 ${d.date < today ? "text-mutedColour line-through" : ""}`}>
                    <span>{d.label}</span>
                    <span className="whitespace-nowrap">{formatDate(d.date)}</span>
                  </li>
                ))}
            </ul>
          </section>

          <section className="card p-6" aria-labelledby="vat-heading">
            <h2 id="vat-heading" className="text-lg font-FiraSans-Bold">VAT</h2>
            {data.vat.profile.registered ? (
              <p className="mt-2 text-sm text-mutedColour">
                Registered{data.vat.profile.number ? ` (${data.vat.profile.number})` : ""}.{" "}
                <Link href="/admin/Money/Vat" className="text-accentColour underline">See your VAT returns</Link>
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-mutedColour">
                  Taxable sales in the last 12 months: <strong className="text-textColour">{formatPence(data.vatThreshold.sales)}</strong> of the{" "}
                  {formatPence(data.vatThreshold.threshold)} registration threshold.
                </p>
                <div className="mt-3 h-2 rounded-full bg-backgroundColour border border-borderColour overflow-hidden" role="progressbar" aria-label="Towards the VAT threshold" aria-valuenow={data.vatThreshold.percent} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full ${data.vatThreshold.percent >= 80 ? "bg-warningColour" : "bg-accentColour"}`} style={{ width: `${Math.min(100, data.vatThreshold.percent)}%` }} />
                </div>
                {data.vatThreshold.percent >= 80 && (
                  <p className="mt-2 text-sm text-warningColour">You&apos;re close to the threshold. You must register within 30 days of going over it.</p>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {!isIe && (
        <section className="mt-6 card p-6" aria-labelledby="mtd-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="mtd-heading" className="text-lg font-FiraSans-Bold">Making Tax Digital quarterly updates</h2>
            <p className="text-xs text-mutedColour">Figures are cumulative from the start of the tax year, as HMRC asks. File them with bridging software or your accountant.</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-borderColour text-left text-xs uppercase tracking-wider text-mutedColour">
                  <th className="py-2">Quarter</th>
                  <th className="py-2">Period</th>
                  <th className="py-2 text-right">Turnover</th>
                  <th className="py-2 text-right">Expenses</th>
                  <th className="py-2 text-right">Due</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {data.quarters.map((q) => (
                  <tr key={q.number} className="border-b border-borderColour last:border-0">
                    <td className="py-2.5">Q{q.number}</td>
                    <td className="py-2.5 text-mutedColour">{formatDate(q.start)} to {formatDate(q.end)}</td>
                    <td className="py-2.5 text-right">{formatPence(q.turnover)}</td>
                    <td className="py-2.5 text-right">{formatPence(q.totalExpenses)}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">{q.due < today && q.end < today ? <Pill tone="grey">{formatDate(q.due)}</Pill> : formatDate(q.due)}</td>
                    <td className="py-2.5 text-right">
                      <a href={`/api/admin/finance/export?kind=quarter&year=${encodeURIComponent(data.year.label)}&quarter=${q.number}`} className={smallButton}>CSV</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Disclaimer />
    </>
  );
}
