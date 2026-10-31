"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignForm({ contractId, bodyHash, defaultName }: { contractId: number; bodyHash: string; defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/portal/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The fingerprint of the text shown on this page, so the signature is tied to exactly that text
      body: JSON.stringify({ contractId, bodyHash, name, agree }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) {
      setError(json?.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-4 max-w-lg">
      <div>
        <label htmlFor="signedName" className="block mb-1 text-sm font-FiraSans-SemiBold">Your full name</label>
        <input id="signedName" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="admin-input" />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-accentColour" />
        <span>I have read this contract and agree to its terms on behalf of the Client, and I am authorised to do so.</span>
      </label>
      {error && <p className="text-sm text-errorColour" role="alert">{error}</p>}
      <div>
        <button type="submit" disabled={busy || !agree || !name.trim()} className="btn-primary disabled:opacity-50">
          {busy ? "Signing…" : "Sign contract"}
        </button>
      </div>
    </form>
  );
}
