"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PostButtonProps {
  url: string;
  body: object;
  label: string;
  busyLabel?: string;
  doneMessage?: string;
  confirm?: string;
  className?: string;
}

// A button that POSTs JSON to a portal API and refreshes the page on success
export default function PostButton({ url, body, label, busyLabel = "Sending…", doneMessage, confirm, className = "btn-primary" }: PostButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) {
      setError(json?.error ?? "Something went wrong. Please try again.");
      return;
    }
    setDone(true);
    router.refresh();
  };

  if (done && doneMessage) return <p className="text-sm text-successColour" role="status">{doneMessage}</p>;

  return (
    <div>
      <button type="button" onClick={send} disabled={busy} className={`${className} disabled:opacity-50`}>
        {busy ? busyLabel : label}
      </button>
      {error && <p className="mt-2 text-sm text-errorColour" role="alert">{error}</p>}
    </div>
  );
}
