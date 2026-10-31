"use client";

import { useCallback, useEffect, useState } from "react";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import { formatDate, formatPence } from "@/lib/format";
import PageHeader from "../../components/pageHeader";
import { api, showError, showSuccess } from "../../components/api";
import { Pill, smallButton } from "../../components/fields";
import { Disclaimer } from "../moneyNav";

interface Line {
  id: number;
  date: string;
  description: string;
  amount: number;
  status: "new" | "matched" | "ignored";
  matchType: string | null;
  suggestions: { id: number; number: string; total: number; clientName: string; score: number }[];
  category: string | null;
}

export default function BankPage() {
  const [showAll, setShowAll] = useState(false);
  const [lines, setLines] = useState<Line[] | null>(null);
  const load = useCallback(() => api<Line[]>(`/api/admin/finance/bank?status=${showAll ? "all" : "new"}`).then(setLines).catch(showError), [showAll]);

  useEffect(() => {
    load();
  }, [load]);

  const importFile = async (file: File) => {
    if (file.size > 5_000_000) return showError(new Error("That file is over 5 MB. Export a shorter date range."));
    try {
      const result = await api<{ read: number; added: number; duplicates: number; skipped: number }>("/api/admin/finance/bank", "POST", { csv: await file.text() });
      showSuccess(`Imported ${result.added} new line${result.added === 1 ? "" : "s"}${result.duplicates ? `, ${result.duplicates} already here` : ""}${result.skipped ? `, ${result.skipped} skipped` : ""}`);
      await load();
    } catch (err) {
      showError(err);
    }
  };

  const act = async (id: number, body: object, message: string) => {
    try {
      await api("/api/admin/finance/bank", "PATCH", { id, ...body });
      showSuccess(message);
      await load();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <>
      <PageHeader title="Bank" description="Upload a CSV statement from your business bank account, then say what each line is. Re-uploading the same statement won't add anything twice." />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="btn-primary cursor-pointer">
          Upload a CSV statement
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-mutedColour">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-accentColour" />
          Show lines already dealt with
        </label>
      </div>

      <ul className="flex flex-col gap-3">
        {lines === null && <li className="text-mutedColour">Loading…</li>}
        {lines?.length === 0 && <li className="card p-6 text-mutedColour">{showAll ? "No bank lines yet." : "Nothing to sort out. Upload a statement to bring in new lines."}</li>}
        {lines?.map((line) => <BankLine key={line.id} line={line} act={act} />)}
      </ul>
      <Disclaimer />
    </>
  );
}

function BankLine({ line, act }: { line: Line; act: (id: number, body: object, message: string) => Promise<void> }) {
  const [category, setCategory] = useState(line.category ?? "other");
  const [vat, setVat] = useState("");
  const moneyIn = line.amount > 0;

  return (
    <li className={`card p-4 ${line.status !== "new" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-FiraSans-SemiBold text-textColour break-words">{line.description}</p>
          <p className="text-xs text-mutedColour">{formatDate(line.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {line.status !== "new" && <Pill tone={line.status === "matched" ? "green" : "grey"}>{line.matchType ?? line.status}</Pill>}
          <span className={`text-lg font-FiraSans-Bold ${moneyIn ? "text-successColour" : "text-textColour"}`}>{moneyIn ? "+" : ""}{formatPence(line.amount)}</span>
        </div>
      </div>

      {line.status === "new" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {moneyIn ? (
            <>
              {line.suggestions.map((s) => (
                <button key={s.id} type="button" className="rounded-md border border-successColour/50 px-3 py-1 text-successColour hover:bg-successColour/10" onClick={() => act(line.id, { action: "invoice", invoiceId: s.id }, `Payment recorded for ${s.number}`)}>
                  Pays {s.number} ({s.clientName}, {formatPence(s.total)})
                </button>
              ))}
              <button type="button" className={smallButton} onClick={() => act(line.id, { action: "income" }, "Recorded as income")}>Other income</button>
            </>
          ) : (
            <>
              <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="admin-input w-auto! py-1.5! text-sm">
                {EXPENSE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input aria-label="VAT included" placeholder="VAT (optional)" value={vat} onChange={(e) => setVat(e.target.value)} className="admin-input w-28! py-1.5! text-sm" />
              <button type="button" className="rounded-md border border-accentColour/60 px-3 py-1 text-accentColour hover:bg-accentColour/10" onClick={() => act(line.id, { action: "expense", category, vat }, "Expense added")}>
                Add as expense
              </button>
            </>
          )}
          <button type="button" className={smallButton} onClick={() => act(line.id, { action: "transfer" }, "Marked as a transfer")}>Transfer</button>
          <button type="button" className={smallButton} onClick={() => act(line.id, { action: "personal" }, "Marked as personal")}>Personal</button>
          <button type="button" className={smallButton} onClick={() => act(line.id, { action: "ignore" }, "Ignored")}>Ignore</button>
        </div>
      ) : (
        (line.status === "ignored" || line.matchType === "transfer" || line.matchType === "personal") && (
          <button type="button" className={`${smallButton} mt-3`} onClick={() => act(line.id, { action: "reset" }, "Back to new")}>Undo</button>
        )
      )}
    </li>
  );
}
