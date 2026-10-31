"use client";

import { useState } from "react";

export default function SupportForm({ projectId }: { projectId: number }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState("sending");
    setError(null);
    const res = await fetch("/api/portal/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, plan: form.get("plan"), months: Number(form.get("months")), message: form.get("message") }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(json?.error ?? "Something went wrong. Please try again.");
      setState("idle");
      return;
    }
    setState("sent");
  };

  if (state === "sent") return <p className="mt-4 text-successColour" role="status">Thanks, I&apos;ll be in touch to set that up.</p>;

  return (
    <form onSubmit={submit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label htmlFor="plan" className="block mb-1 text-sm font-FiraSans-SemiBold">Plan</label>
        <select id="plan" name="plan" className="admin-input" defaultValue="standard">
          <option value="standard">Standard</option>
          <option value="priority">Priority</option>
        </select>
      </div>
      <div>
        <label htmlFor="months" className="block mb-1 text-sm font-FiraSans-SemiBold">For how long?</label>
        <select id="months" name="months" className="admin-input" defaultValue="12">
          <option value="3">3 months</option>
          <option value="6">6 months</option>
          <option value="12">12 months</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="message" className="block mb-1 text-sm font-FiraSans-SemiBold">Anything I should know? (optional)</label>
        <textarea id="message" name="message" rows={3} maxLength={2000} className="admin-input" />
      </div>
      {error && <p className="sm:col-span-2 text-sm text-errorColour" role="alert">{error}</p>}
      <div>
        <button type="submit" disabled={state === "sending"} className="btn-secondary disabled:opacity-50">
          {state === "sending" ? "Sending…" : "Request extended support"}
        </button>
      </div>
    </form>
  );
}
