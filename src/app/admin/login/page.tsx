"use client";

import { useState } from "react";

const inputClass =
  "w-full bg-backgroundColour text-textColour rounded-lg border border-borderColour py-3 px-4 focus:outline-none focus:border-accentColour placeholder:text-mutedColour";

export default function AdminLogin() {
  const [step, setStep] = useState<"password" | "code">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { res, json: await res.json().catch(() => ({})) };
  };

  const submitPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { res, json } = await post("/api/auth/login", { password });
      if (!res.ok) return setError(json.error ?? "Login failed");
      setSentTo(json.sentTo ?? "your email");
      setPassword("");
      setStep("code");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { res, json } = await post("/api/auth/verify", { code });
      if (!res.ok) {
        setError(json.error ?? "That code didn't work");
        if (json.restart) setStep("password");
        return;
      }
      // Only allow redirects back into the admin area
      const from = new URLSearchParams(window.location.search).get("from") ?? "";
      window.location.href = from.startsWith("/admin") ? from : "/admin";
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-backgroundColour flex items-center justify-center p-5">
      {step === "password" ? (
        <form onSubmit={submitPassword} className="card w-full max-w-sm p-8 flex flex-col gap-4">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="mt-1 text-2xl font-FiraSans-ExtraBold text-textColour">Sign in</h1>
          </div>
          <input
            type="password"
            autoComplete="current-password"
            aria-label="Password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-sm text-errorColour" role="alert">{error}</p>}
          <button type="submit" disabled={loading || password === ""} className="btn-primary disabled:opacity-50">
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="card w-full max-w-sm p-8 flex flex-col gap-4">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="mt-1 text-2xl font-FiraSans-ExtraBold text-textColour">Check your email</h1>
            <p className="mt-2 text-sm text-mutedColour">We sent a 6-digit code to {sentTo}. It expires in 10 minutes.</p>
          </div>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="6-digit code"
            placeholder="123456"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
            className={`${inputClass} text-center text-2xl tracking-[0.4em] font-mono`}
            autoFocus
          />
          {error && <p className="text-sm text-errorColour" role="alert">{error}</p>}
          <button type="submit" disabled={loading || code.replace(/\s/g, "").length !== 6} className="btn-primary disabled:opacity-50">
            {loading ? "Checking…" : "Sign in"}
          </button>
          <button type="button" className="text-sm text-mutedColour underline underline-offset-4" onClick={() => { setStep("password"); setCode(""); setError(null); }}>
            Didn&apos;t get it? Start again
          </button>
        </form>
      )}
    </main>
  );
}
