"use client";

import { useCallback, useEffect, useState } from "react";
import { MdOutlineEmail, MdOutlineLock, MdOutlineDevices } from "react-icons/md";
import { formatDateTime } from "@/lib/format";
import PageHeader from "../components/pageHeader";
import { api, ApiError, showError, showSuccess } from "../components/api";
import { TextField } from "../components/fields";

interface Account {
  email: string;
  password: { source: "env" | "admin"; changedAt: string | null };
  logins: { ip: string; userAgent: string; at: string }[];
}

// "Mozilla/5.0 (Macintosh…) Chrome/…" → "Chrome on Mac"
function device(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "A browser";
  const os = /iPhone|iPad/.test(userAgent) ? "iPhone or iPad" : /Android/.test(userAgent) ? "Android" : /Mac OS X/.test(userAgent) ? "Mac" : /Windows/.test(userAgent) ? "Windows" : /Linux/.test(userAgent) ? "Linux" : "an unknown device";
  return `${browser} on ${os}`;
}

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const load = useCallback(() => api<Account>("/api/admin/account").then(setAccount).catch(showError), []);

  useEffect(() => {
    load();
  }, [load]);

  const signOutEverywhere = async () => {
    if (!window.confirm("Sign out every other browser and device? You'll stay signed in here.")) return;
    try {
      await api("/api/admin/account", "POST", { action: "sign-out-everywhere" });
      showSuccess("Every other session has been signed out");
    } catch (err) {
      showError(err);
    }
  };

  if (!account) return <p className="text-mutedColour">Loading…</p>;

  return (
    <>
      <PageHeader title="Account and security" description="How you sign in to this admin." />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-6">
          <section className="card p-6" aria-labelledby="signin-heading">
            <div className="flex items-center gap-2">
              <MdOutlineEmail className="text-accentColour" aria-hidden />
              <h2 id="signin-heading" className="text-lg font-FiraSans-Bold">Sign-in codes</h2>
            </div>
            <p className="mt-2 text-sm text-mutedColour">
              After your password, a 6-digit code is emailed to <strong className="text-textColour">{account.email || "nobody: set ADMIN_EMAIL"}</strong>. This address is set
              with <code className="text-accentColour">ADMIN_EMAIL</code> on the server, so it can&apos;t be changed from here by anyone who gets into your account.
            </p>
          </section>
          <ChangePassword account={account} onChanged={load} />
        </div>

        <section className="card p-6" aria-labelledby="sessions-heading">
          <div className="flex items-center gap-2">
            <MdOutlineDevices className="text-accentColour" aria-hidden />
            <h2 id="sessions-heading" className="text-lg font-FiraSans-Bold">Recent sign-ins</h2>
          </div>
          <ul className="mt-4 divide-y divide-borderColour text-sm">
            {account.logins.length === 0 && <li className="py-2 text-mutedColour">No sign-ins recorded yet.</li>}
            {account.logins.map((login) => (
              <li key={login.at} className="flex justify-between gap-4 py-2.5">
                <span>
                  {device(login.userAgent)}
                  <span className="block text-xs text-mutedColour">IP {login.ip}</span>
                </span>
                <span className="text-mutedColour whitespace-nowrap">{formatDateTime(login.at)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-mutedColour">Don&apos;t recognise one? Change your password and sign out everywhere.</p>
          <button type="button" className="btn-secondary mt-3" onClick={signOutEverywhere}>Sign out everywhere else</button>
        </section>
      </div>
    </>
  );
}

function ChangePassword({ account, onChanged }: { account: Account; onChanged: () => void }) {
  const [values, setValues] = useState({ current: "", next: "", confirm: "", code: "" });
  const [codeSent, setCodeSent] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const sendCode = async () => {
    setError(null);
    try {
      const { sentTo } = await api<{ sentTo: string }>("/api/admin/account", "POST", { action: "send-code" });
      setCodeSent(sentTo);
    } catch (err) {
      setError(err as ApiError);
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (values.next !== values.confirm) return setError(new ApiError("The new passwords don't match", "confirm"));
    setBusy(true);
    try {
      await api("/api/admin/account", "POST", { action: "change-password", current: values.current, next: values.next, code: values.code });
      showSuccess("Password changed. Every other session has been signed out.");
      setValues({ current: "", next: "", confirm: "", code: "" });
      setCodeSent("");
      onChanged();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-6" aria-labelledby="password-heading">
      <div className="flex items-center gap-2">
        <MdOutlineLock className="text-accentColour" aria-hidden />
        <h2 id="password-heading" className="text-lg font-FiraSans-Bold">Password</h2>
      </div>
      <p className="mt-2 text-sm text-mutedColour">
        {account.password.source === "admin"
          ? `Changed here${account.password.changedAt ? ` on ${formatDateTime(account.password.changedAt)}` : ""}. ADMIN_PASSWORD on the server no longer works.`
          : "You're signing in with ADMIN_PASSWORD from the server. Set a password here and that one stops working."}
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <TextField id="pw-current" label="Current password" type="password" value={values.current} onChange={(v) => set("current", v)} />
        <TextField id="pw-next" label="New password" type="password" value={values.next} onChange={(v) => set("next", v)} help="At least 12 characters. A few random words work well." />
        <TextField id="pw-confirm" label="New password again" type="password" value={values.confirm} onChange={(v) => set("confirm", v)} />
        {codeSent ? (
          <TextField id="pw-code" label={`Code sent to ${codeSent}`} value={values.code} onChange={(v) => set("code", v.replace(/[^\d]/g, ""))} />
        ) : (
          <div>
            <button type="button" className="btn-secondary" onClick={sendCode}>Email me a code</button>
          </div>
        )}
        {error && <p className="text-sm text-errorColour" role="alert">{error.message}</p>}
        <div>
          <button type="submit" disabled={busy || !codeSent} className="btn-primary disabled:opacity-50">{busy ? "Changing…" : "Change password"}</button>
        </div>
      </form>
    </section>
  );
}
