'use client';

import { useState } from "react";
import type { Invoice, Project } from "@/lib/query/clients.query";
import { formatDate, formatPence } from "@/lib/format";
import { api, showError, showSuccess } from "./api";
import { Pill, smallButton } from "./fields";

const TONES = { unpaid: "amber", paid: "green", void: "grey" } as const;

// Milestone invoices appear here automatically when you request a payment. Hosting invoices are raised from here.
export default function JobInvoices({ project, invoices, reload }: { project: Project; invoices: Invoice[]; reload: () => Promise<unknown> }) {
  const [months, setMonths] = useState("12");

  const run = async (method: string, body: object, message: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    try {
      await api("/api/admin/invoices", method, body);
      showSuccess(message);
      await reload();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <section className="card p-6">
      <h2 className="text-lg font-FiraSans-Bold">Invoices</h2>
      <p className="mt-1 text-sm text-mutedColour">
        Requesting a milestone payment issues its invoice and emails the client. Paying it, by bank or card, marks it paid, so it doubles as the receipt.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {invoices.length === 0 && <li className="text-sm text-mutedColour">No invoices yet.</li>}
        {invoices.map((invoice) => (
          <li key={invoice.id} className="rounded-lg border border-borderColour bg-backgroundColour p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <a href={`/admin/invoices/${invoice.id}`} target="_blank" rel="noreferrer" className="font-mono font-FiraSans-Bold hover:text-accentColour">{invoice.number}</a>
              <span className="text-mutedColour">
                {" "}· {invoice.data.lines[0]?.description} · {formatPence(invoice.total)} · issued {formatDate(invoice.issuedAt)}
                {invoice.status === "paid" && invoice.paidAt
                  ? ` · paid ${formatDate(invoice.paidAt)}${invoice.data.paidBy ? ` by ${invoice.data.paidBy === "card" ? "card" : "bank transfer"}` : ""}`
                  : invoice.status === "unpaid"
                    ? ` · due ${formatDate(invoice.dueAt)}`
                    : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={TONES[invoice.status]}>{invoice.status}</Pill>
              {invoice.kind === "hosting" && invoice.status === "unpaid" && (
                <>
                  <button type="button" className={smallButton} onClick={() => run("PATCH", { id: invoice.id, action: "paid" }, "Marked paid; hosting extended", `Confirm ${formatPence(invoice.total)} has arrived? Hosting will be extended by ${invoice.months} month(s).`)}>
                    Mark paid
                  </button>
                  <button type="button" className={smallButton} onClick={() => run("PATCH", { id: invoice.id, action: "void" }, "Invoice voided", "Void this invoice? It stays on record but can't be paid.")}>
                    Void
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {project.hostingMonthly > 0 && (
        <div className="mt-5 pt-5 border-t border-borderColour flex flex-wrap items-center gap-2">
          <label htmlFor="hosting-months" className="text-sm font-FiraSans-SemiBold">Invoice hosting for</label>
          <select id="hosting-months" value={months} onChange={(e) => setMonths(e.target.value)} className="admin-input w-auto! py-2!">
            {[1, 3, 6, 12].map((m) => (
              <option key={m} value={m}>{m} month{m === 1 ? "" : "s"} ({formatPence(project.hostingMonthly * m)})</option>
            ))}
          </select>
          <button type="button" className="btn-secondary py-2!" onClick={() => run("POST", { projectId: project.id, months: Number(months) }, "Hosting invoice sent", `Email the client a hosting invoice for ${formatPence(project.hostingMonthly * Number(months))}?`)}>
            Create and email
          </button>
        </div>
      )}
    </section>
  );
}
