"use client";

import { useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    const res = await fetch("/api/portal/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(json?.error ?? "Something went wrong. Please try again.");
      setState("idle");
      return;
    }
    setState("sent");
  };

  if (state === "sent") {
    return (
      <div className="mt-8 card p-6" role="status">
        <p className="font-FiraSans-Bold">Check your inbox</p>
        <p className="mt-2 text-mutedColour">
          If {email} has a client portal, a sign-in link is on its way. It expires in 20 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 card p-6 flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="block mb-1 text-sm font-FiraSans-SemiBold">Email address</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="admin-input" />
      </div>
      {error && <p className="text-sm text-errorColour" role="alert">{error}</p>}
      <button type="submit" disabled={state === "sending" || !email} className="btn-primary disabled:opacity-50">
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
