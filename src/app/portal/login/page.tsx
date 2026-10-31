import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalClient } from "@/lib/session";
import LoginForm from "./loginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function PortalLoginPage() {
  if (await getPortalClient()) redirect("/portal");
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-3xl font-FiraSans-ExtraBold">Sign in to your client portal</h1>
      <p className="mt-3 text-mutedColour">
        Enter the email address you use with me and I&apos;ll send you a sign-in link. No password needed.
      </p>
      <LoginForm />
    </div>
  );
}
