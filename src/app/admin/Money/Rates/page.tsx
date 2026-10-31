"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/pageHeader";
import { api, showError, showSuccess } from "../../components/api";
import { smallButton } from "../../components/fields";
import { Disclaimer } from "../moneyNav";

interface RatesResponse {
  rates: Record<string, unknown> & { year: string; checked?: string; sources?: string[] };
  fallback: boolean;
  overridden: boolean;
  builtInYears: string[];
}

export default function RatesPage() {
  const [year, setYear] = useState("");
  const [data, setData] = useState<RatesResponse | null>(null);
  const [json, setJson] = useState("");

  const load = useCallback(async (y: string) => {
    try {
      const result = await api<RatesResponse>(`/api/admin/finance/rates?year=${encodeURIComponent(y)}`);
      setData(result);
      const { country: _country, year: _year, checked: _checked, sources: _sources, ...editable } = result.rates;
      setJson(JSON.stringify(editable, null, 2));
    } catch (err) {
      showError(err);
    }
  }, []);

  useEffect(() => {
    // Start on the current tax year, worked out from the summary
    api<{ year: { label: string } }>("/api/admin/finance/summary").then((s) => {
      setYear(s.year.label);
      load(s.year.label);
    }).catch(showError);
  }, [load]);

  const save = async () => {
    try {
      await api("/api/admin/finance/rates", "PUT", { year, json });
      showSuccess(`Rates for ${year} saved`);
      await load(year);
    } catch (err) {
      showError(err);
    }
  };

  const reset = async () => {
    if (!window.confirm(`Go back to the built-in rates for ${year}?`)) return;
    try {
      await api("/api/admin/finance/rates", "DELETE", { year });
      await load(year);
    } catch (err) {
      showError(err);
    }
  };

  return (
    <>
      <PageHeader title="Tax rates" description="The rates and thresholds behind your estimates. Built in for recent years; correct them here when a budget changes something. Amounts are whole pounds or euro." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="rates-year" className="text-sm text-mutedColour">Tax year</label>
        <input id="rates-year" value={year} onChange={(e) => setYear(e.target.value)} className="admin-input w-32! py-2!" />
        <button type="button" className={smallButton} onClick={() => load(year)}>Show</button>
        {data && <span className="text-xs text-mutedColour">Built in: {data.builtInYears.join(", ")}</span>}
      </div>
      {data && (
        <section className="card p-6">
          {data.fallback && <p className="mb-3 text-sm text-warningColour">No rates for {year} yet: these are copied from the latest year. Check and save them.</p>}
          {data.overridden && <p className="mb-3 text-sm text-accentColour">You&apos;ve changed these from the built-in rates.</p>}
          {!data.overridden && data.rates.checked && (
            <p className="mb-3 text-sm text-mutedColour">
              Last checked {data.rates.checked}. Sources: {(data.rates.sources ?? []).map((s) => <a key={s} href={s} target="_blank" rel="noreferrer" className="text-accentColour underline mr-2">{new URL(s).hostname}</a>)}
            </p>
          )}
          <textarea aria-label="Rates" value={json} onChange={(e) => setJson(e.target.value)} rows={28} className="admin-input font-mono text-xs" spellCheck={false} />
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary" onClick={save}>Save for {year}</button>
            {data.overridden && <button type="button" className="btn-secondary" onClick={reset}>Use built-in rates</button>}
          </div>
        </section>
      )}
      <Disclaimer />
    </>
  );
}
