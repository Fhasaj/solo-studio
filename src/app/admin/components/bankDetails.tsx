'use client';

import { useEffect, useState } from "react";
import { MdLock, MdLockOpen } from "react-icons/md";
import { formatDateTime } from "@/lib/format";
import { api, ApiError, showError, showSuccess } from "./api";
import { TextField } from "./fields";

interface Bank {
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  updatedAt: string | null;
  unlocked: boolean;
}

// Bank details are masked until you enter a code emailed to ADMIN_EMAIL; then they stay unlocked for 10 minutes
export default function BankDetails() {
  const [bank, setBank] = useState<Bank | null>(null);
  const [step, setStep] = useState<"locked" | "code" | "unlocked">("locked");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [values, setValues] = useState({ bankAccountName: "", bankSortCode: "", bankAccountNumber: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const show = (data: Bank) => {
    setBank(data);
    if (data.unlocked) {
      setValues({ bankAccountName: data.bankAccountName, bankSortCode: data.bankSortCode, bankAccountNumber: data.bankAccountNumber });
      setStep("unlocked");
    }
  };

  useEffect(() => {
    api<Bank>("/api/admin/bank").then(show).catch(showError);
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const { sentTo } = await api<{ sentTo: string }>("/api/admin/bank", "POST", { action: "send-code" });
      setSentTo(sentTo);
      setCode("");
      setStep("code");
    });

  const unlock = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    run(async () => show(await api<Bank>("/api/admin/bank", "POST", { action: "unlock", code })));
  };

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    run(async () => {
      show(await api<Bank>("/api/admin/bank", "PUT", { values }));
      showSuccess("Bank details saved. A confirmation has been emailed to you.");
    });
  };

  const lock = () =>
    run(async () => {
      setBank(await api<Bank>("/api/admin/bank", "POST", { action: "lock" }));
      setStep("locked");
    });

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2">
        {step === "unlocked" ? <MdLockOpen className="text-warningColour" aria-hidden /> : <MdLock className="text-successColour" aria-hidden />}
        <h2 className="text-xl font-FiraSans-Bold text-textColour">Bank details</h2>
      </div>
      <p className="mt-1 text-sm text-mutedColour">
        Shown to clients when a payment is due. Stored encrypted. To see or change them you need a code from your email, and every change is
        emailed to you.
      </p>

      {step !== "unlocked" && bank && (
        <dl className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg border border-borderColour bg-backgroundColour p-4">
          {[
            ["Account name", bank.bankAccountName],
            ["Sort code", bank.bankSortCode],
            ["Account number", bank.bankAccountNumber],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wider text-mutedColour">{label}</dt>
              <dd className="mt-1 font-mono text-textColour">{value || "Not set"}</dd>
            </div>
          ))}
        </dl>
      )}
      {bank?.updatedAt && <p className="mt-2 text-xs text-mutedColour">Last changed {formatDateTime(bank.updatedAt)}</p>}

      {step === "locked" && (
        <button type="button" onClick={sendCode} disabled={busy} className="btn-secondary mt-5 disabled:opacity-50">
          {busy ? "Sending code…" : "Email me a code to view or change"}
        </button>
      )}

      {step === "code" && (
        <form onSubmit={unlock} className="mt-5 flex flex-col gap-3 max-w-xs">
          <label htmlFor="bank-code" className="text-sm text-mutedColour">Enter the 6-digit code sent to {sentTo}</label>
          <input
            id="bank-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
            className="admin-input text-center text-xl tracking-[0.4em] font-mono"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6} className="btn-primary disabled:opacity-50">Unlock</button>
            <button type="button" onClick={() => setStep("locked")} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {step === "unlocked" && (
        <form onSubmit={save} className="mt-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextField id="bank-name" label="Account name" maxLength={70} value={values.bankAccountName} onChange={(v) => setValues((p) => ({ ...p, bankAccountName: v }))} />
            <TextField id="bank-sort" label="Sort code" maxLength={8} placeholder="12-34-56" value={values.bankSortCode} onChange={(v) => setValues((p) => ({ ...p, bankSortCode: v }))} />
            <TextField id="bank-number" label="Account number" maxLength={8} placeholder="12345678" value={values.bankAccountNumber} onChange={(v) => setValues((p) => ({ ...p, bankAccountNumber: v }))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "Saving…" : "Save bank details"}</button>
            <button type="button" onClick={lock} className="btn-secondary">Lock again</button>
          </div>
          <p className="text-xs text-mutedColour">Unlocked for 10 minutes, then locked automatically.</p>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-errorColour" role="alert">{error.message}</p>}
    </section>
  );
}
