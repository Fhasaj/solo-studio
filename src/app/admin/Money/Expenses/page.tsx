"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { financeYear } from "@/lib/finance";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import type { Expense } from "@/lib/query/finance.query";
import { formatDate, formatPence, penceToInput } from "@/lib/format";
import { CURRENCY_SYMBOL } from "@/lib/currency";
import PageHeader from "../../components/pageHeader";
import { api, ApiError, showError, showSuccess } from "../../components/api";
import { dangerButton, smallButton, TextField } from "../../components/fields";
import { Disclaimer } from "../moneyNav";

type Year = ReturnType<typeof financeYear>;

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { date: "", supplier: "", description: "", category: "office", amount: "", vat: "", businessPercent: "100" };

export default function ExpensesPage() {
  const [data, setData] = useState<Year | null>(null);
  const load = useCallback(() => api<Year>("/api/admin/finance/summary").then(setData).catch(showError), []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className="text-mutedColour">Loading…</p>;

  return (
    <>
      <PageHeader title="Expenses, mileage and income" description={`Tax year ${data.year.label}. Record costs when you pay them. Keep receipts: HMRC can ask for them for 5 years, Revenue for 6.`} />
      <Expenses data={data} reload={load} />
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <Mileage data={data} reload={load} />
        <OtherIncome data={data} reload={load} />
      </div>
      <Disclaimer />
    </>
  );
}

// ---- Expenses ----

function Expenses({ data, reload }: { data: Year; reload: () => Promise<unknown> }) {
  const [form, setForm] = useState({ ...EMPTY, date: today() });
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const receipt = useRef<HTMLInputElement>(null);
  const [receiptFor, setReceiptFor] = useState<number | null>(null);
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const label = (key: string) => EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/admin/finance/expenses", editing ? "PUT" : "POST", editing ? { id: editing, ...form } : form);
      showSuccess(editing ? "Expense saved" : "Expense added");
      setForm({ ...EMPTY, date: form.date });
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err as ApiError);
    }
  };

  const edit = (expense: Expense) => {
    setEditing(expense.id);
    setForm({
      date: expense.date,
      supplier: expense.supplier,
      description: expense.description,
      category: expense.category,
      amount: penceToInput(expense.amount),
      vat: expense.vat ? penceToInput(expense.vat) : "",
      businessPercent: String(expense.businessPercent),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (expense: Expense) => {
    if (!window.confirm(`Delete this expense${expense.receiptName ? " and its receipt" : ""}?`)) return;
    try {
      await api("/api/admin/finance/expenses", "DELETE", { id: expense.id });
      await reload();
    } catch (err) {
      showError(err);
    }
  };

  const uploadReceipt = async (file: File) => {
    if (!receiptFor) return;
    const body = new FormData();
    body.append("expenseId", String(receiptFor));
    body.append("file", file);
    const res = await fetch("/api/admin/finance/receipt", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    if (receipt.current) receipt.current.value = "";
    if (!res.ok) return showError(new Error(json.error ?? "Upload failed"));
    showSuccess("Receipt saved (encrypted)");
    await reload();
  };

  return (
    <section className="card p-6" aria-labelledby="expenses-heading">
      <h2 id="expenses-heading" className="text-lg font-FiraSans-Bold">Expenses</h2>
      <form onSubmit={submit} className="mt-4 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
        <TextField id="e-date" label="Date paid" type="date" value={form.date} onChange={(v) => set("date", v)} />
        <TextField id="e-supplier" label="Supplier" maxLength={120} value={form.supplier} onChange={(v) => set("supplier", v)} placeholder="e.g. Hetzner" />
        <div className="xl:col-span-2">
          <label htmlFor="e-category" className="block mb-1 text-sm font-FiraSans-SemiBold">Category</label>
          <select id="e-category" value={form.category} onChange={(e) => set("category", e.target.value)} className="admin-input">
            {EXPENSE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <TextField id="e-amount" label={`Amount paid (${CURRENCY_SYMBOL})`} value={form.amount} onChange={(v) => set("amount", v)} placeholder="12.00" />
        <TextField id="e-vat" label={`VAT in it (${CURRENCY_SYMBOL})`} value={form.vat} onChange={(v) => set("vat", v)} placeholder="2.00" />
        <div className="md:col-span-2 xl:col-span-3">
          <TextField id="e-description" label="Description (optional)" maxLength={300} value={form.description} onChange={(v) => set("description", v)} />
        </div>
        <TextField id="e-business" label="Business use %" type="number" value={form.businessPercent} onChange={(v) => set("businessPercent", v)} help="e.g. 50 for a phone used half for work" />
        <div className="flex gap-2 xl:col-span-2">
          <button type="submit" className="btn-primary py-2.5!">{editing ? "Save" : "Add expense"}</button>
          {editing && <button type="button" className="btn-secondary py-2.5!" onClick={() => { setEditing(null); setForm({ ...EMPTY, date: today() }); }}>Cancel</button>}
        </div>
        {error && <p className="md:col-span-3 xl:col-span-6 text-sm text-errorColour">{error.message}</p>}
      </form>

      <input ref={receipt} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadReceipt(e.target.files[0])} />
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-borderColour text-left text-xs uppercase tracking-wider text-mutedColour">
              <th className="py-2">Date</th>
              <th className="py-2">Supplier and description</th>
              <th className="py-2">Category</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2 text-right">VAT</th>
              <th className="py-2 text-right">Business</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data.expenses.length === 0 && (
              <tr><td colSpan={7} className="py-4 text-mutedColour">No expenses this tax year yet. Add them here or from your bank statement.</td></tr>
            )}
            {data.expenses.map((expense) => (
              <tr key={expense.id} className={`border-b border-borderColour last:border-0 ${editing === expense.id ? "bg-accentColour/5" : ""}`}>
                <td className="py-2 whitespace-nowrap">{formatDate(expense.date)}</td>
                <td className="py-2">{[expense.supplier, expense.description].filter(Boolean).join(": ")}</td>
                <td className="py-2 text-mutedColour">{label(expense.category)}</td>
                <td className="py-2 text-right">{formatPence(expense.amount)}</td>
                <td className="py-2 text-right text-mutedColour">{expense.vat ? formatPence(expense.vat) : "–"}</td>
                <td className="py-2 text-right text-mutedColour">{expense.businessPercent}%</td>
                <td className="py-2 text-right whitespace-nowrap">
                  {expense.receiptName ? (
                    <a href={`/api/admin/finance/receipt?id=${expense.id}`} target="_blank" rel="noreferrer" className={smallButton}>Receipt</a>
                  ) : (
                    <button type="button" className={smallButton} onClick={() => { setReceiptFor(expense.id); receipt.current?.click(); }}>Add receipt</button>
                  )}{" "}
                  <button type="button" className={smallButton} onClick={() => edit(expense)}>Edit</button>{" "}
                  <button type="button" className={dangerButton} onClick={() => remove(expense)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---- Mileage ----

function Mileage({ data, reload }: { data: Year; reload: () => Promise<unknown> }) {
  const unit = data.country === "ie" ? "km" : "miles";
  const [form, setForm] = useState({ date: today(), purpose: "", route: "", distance: "", vehicle: "car" });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await api("/api/admin/finance/records", "POST", { kind: "mileage", ...form });
      setForm((f) => ({ ...f, purpose: "", route: "", distance: "" }));
      await reload();
    } catch (err) {
      showError(err);
    }
  };

  const remove = async (id: number) => {
    try {
      await api("/api/admin/finance/records", "DELETE", { kind: "mileage", id });
      await reload();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <section className="card p-6" aria-labelledby="mileage-heading">
      <h2 id="mileage-heading" className="text-lg font-FiraSans-Bold">Business mileage</h2>
      <p className="mt-1 text-xs text-mutedColour">
        {data.country === "ie"
          ? "Uses your rate per km from Settings → Tax and VAT."
          : "HMRC rates: 45p a mile for the first 10,000 car miles in the tax year, then 25p; 24p motorbike, 20p bicycle. Don't also claim fuel for the same trips."}
      </p>
      <form onSubmit={add} className="mt-4 grid grid-cols-2 gap-3">
        <TextField id="m-date" label="Date" type="date" value={form.date} onChange={(v) => set("date", v)} />
        <TextField id="m-distance" label={`Distance (${unit})`} value={form.distance} onChange={(v) => set("distance", v)} />
        <TextField id="m-purpose" label="Purpose" maxLength={200} value={form.purpose} onChange={(v) => set("purpose", v)} placeholder="Client meeting" />
        <TextField id="m-route" label="From and to (optional)" maxLength={200} value={form.route} onChange={(v) => set("route", v)} />
        <div>
          <label htmlFor="m-vehicle" className="block mb-1 text-sm font-FiraSans-SemiBold">Vehicle</label>
          <select id="m-vehicle" value={form.vehicle} onChange={(e) => set("vehicle", e.target.value)} className="admin-input">
            <option value="car">Car or van</option>
            <option value="motorcycle">Motorcycle</option>
            <option value="bicycle">Bicycle</option>
          </select>
        </div>
        <div className="self-end"><button type="submit" className="btn-secondary w-full">Add trip</button></div>
      </form>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {data.mileage.map((trip) => (
          <li key={trip.id} className="flex items-center justify-between gap-3 rounded-lg border border-borderColour bg-backgroundColour p-3">
            <span>{formatDate(trip.date)} · {trip.purpose} · {trip.distance} {unit}</span>
            <span className="flex items-center gap-2">
              {formatPence(trip.amount)}
              <button type="button" className={dangerButton} onClick={() => remove(trip.id)}>Delete</button>
            </span>
          </li>
        ))}
        {data.mileage.length > 0 && <li className="text-right font-FiraSans-Bold">Total {formatPence(data.mileageTotal)}</li>}
      </ul>
    </section>
  );
}

// ---- Other income ----

function OtherIncome({ data, reload }: { data: Year; reload: () => Promise<unknown> }) {
  const [form, setForm] = useState({ date: today(), description: "", amount: "", vat: "" });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await api("/api/admin/finance/records", "POST", { kind: "income", ...form });
      setForm((f) => ({ ...f, description: "", amount: "", vat: "" }));
      await reload();
    } catch (err) {
      showError(err);
    }
  };

  const remove = async (id: number) => {
    try {
      await api("/api/admin/finance/records", "DELETE", { kind: "income", id });
      await reload();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <section className="card p-6" aria-labelledby="income-heading">
      <h2 id="income-heading" className="text-lg font-FiraSans-Bold">Income</h2>
      <p className="mt-1 text-xs text-mutedColour">Paid invoices are counted automatically. Add business income you received some other way here.</p>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {data.income.invoices.map((invoice) => (
          <li key={invoice.id} className="flex justify-between gap-3 rounded-lg border border-borderColour bg-backgroundColour p-3">
            <span>{formatDate(String(invoice.paidAt).slice(0, 10))} · {invoice.number} · {invoice.clientName}</span>
            <span>{formatPence(invoice.net)}</span>
          </li>
        ))}
        {data.income.other.map((income) => (
          <li key={income.id} className="flex items-center justify-between gap-3 rounded-lg border border-borderColour bg-backgroundColour p-3">
            <span>{formatDate(income.date)} · {income.description}</span>
            <span className="flex items-center gap-2">
              {formatPence(income.amount)}
              <button type="button" className={dangerButton} onClick={() => remove(income.id)}>Delete</button>
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-4 grid grid-cols-2 gap-3">
        <TextField id="i-date" label="Date received" type="date" value={form.date} onChange={(v) => set("date", v)} />
        <TextField id="i-amount" label={`Amount excluding VAT (${CURRENCY_SYMBOL})`} value={form.amount} onChange={(v) => set("amount", v)} />
        <TextField id="i-description" label="Description" maxLength={200} value={form.description} onChange={(v) => set("description", v)} />
        <TextField id="i-vat" label={`VAT charged (${CURRENCY_SYMBOL})`} value={form.vat} onChange={(v) => set("vat", v)} placeholder="0" />
        <div className="col-span-2"><button type="submit" className="btn-secondary">Add income</button></div>
      </form>
    </section>
  );
}
