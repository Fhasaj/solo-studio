"use client";

import { useState } from "react";
import Link from "next/link";

// Signing in takes a click, so email link scanners that open the page can't use up the one-time link
export default function VerifyButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/portal/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(json?.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    window.location.href = "/portal";
  };

  return (
    <div className="mt-8">
      <button type="button" onClick={signIn} disabled={busy} className="btn-primary disabled:opacity-50">
        {busy ? "Signing in…" : "Continue to your portal"}
      </button>
      {error && (
        <p className="mt-4 text-sm text-errorColour" role="alert">
          {error} <Link href="/portal/login" className="underline underline-offset-2">Get a new link</Link>
        </p>
      )}
    </div>
  );
}
