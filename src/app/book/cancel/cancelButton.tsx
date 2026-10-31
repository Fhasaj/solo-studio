"use client";

import { useState } from "react";
import Link from "next/link";

export default function CancelButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setState("working");
    setError(null);
    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(json?.error ?? "Something went wrong. Please try again.");
      setState("idle");
      return;
    }
    setState("done");
  };

  if (state === "done") {
    return (
      <p className="mt-4 text-textColour" role="status">
        Your call has been cancelled. <Link href="/book" className="text-accentColour underline underline-offset-4">Book a new time</Link> whenever suits you.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <button type="button" onClick={cancel} disabled={state === "working"} className="btn-secondary disabled:opacity-50">
        {state === "working" ? "Cancelling…" : "Cancel this call"}
      </button>
      {error && <p className="mt-3 text-sm text-errorColour" role="alert">{error}</p>}
    </div>
  );
}
