"use client";

export default function SignOutButton() {
  const signOut = async () => {
    await fetch("/api/portal/logout", { method: "POST" });
    window.location.href = "/portal/login";
  };
  return (
    <button type="button" onClick={signOut} className="rounded-md border border-borderColour px-3 py-1.5 hover:border-accentColour hover:text-accentColour">
      Sign out
    </button>
  );
}
