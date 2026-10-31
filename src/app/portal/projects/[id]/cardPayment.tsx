"use client";

import { useState } from "react";
import { formatPence } from "@/lib/format";

// Sends the client to Stripe's payment page. UK law only allows a fee on business cards, so they choose which they're using.
export default function CardPayment({ milestoneId, amount, businessFee }: { milestoneId: number; amount: number; businessFee: number }) {
  const [busy, setBusy] = useState<"business" | "personal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pay = async (cardType: "business" | "personal") => {
    setBusy(cardType);
    setError(null);
    const res = await fetch("/api/portal/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneId, cardType }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    if (!res?.ok || !json?.url) {
      setError(json?.error ?? "Card payment isn't available right now. Please pay by bank transfer.");
      setBusy(null);
      return;
    }
    window.location.assign(json.url);
  };

  return (
    <div className="mt-6 pt-5 border-t border-borderColour">
      <h3 className="text-sm font-FiraSans-SemiBold">Or pay by card</h3>
      <p className="mt-1 text-xs text-mutedColour">You&apos;ll pay on Stripe&apos;s secure page. Your card details never reach this site.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => pay("business")} disabled={busy !== null} className="btn-secondary disabled:opacity-50">
          {busy === "business" ? "Opening Stripe…" : `Business card: ${formatPence(amount + businessFee)}`}
        </button>
        <button type="button" onClick={() => pay("personal")} disabled={busy !== null} className="btn-secondary disabled:opacity-50">
          {busy === "personal" ? "Opening Stripe…" : `Personal card: ${formatPence(amount)}`}
        </button>
      </div>
      {businessFee > 0 && (
        <p className="mt-2 text-xs text-mutedColour">
          Business and company cards include a {formatPence(businessFee)} card processing fee. There&apos;s no fee for personal cards or bank transfer.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-errorColour" role="alert">{error}</p>}
    </div>
  );
}
