import type { Metadata } from "next";
import Link from "next/link";
import VerifyButton from "./verifyButton";

export const metadata: Metadata = { title: "Sign in" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="max-w-md mx-auto text-center">
      <h1 className="text-3xl font-FiraSans-ExtraBold">Sign in to your client portal</h1>
      {typeof token === "string" && token ? (
        <VerifyButton token={token} />
      ) : (
        <p className="mt-4 text-mutedColour">
          This sign-in link is incomplete. <Link href="/portal/login" className="text-accentColour underline underline-offset-4">Request a new one</Link>.
        </p>
      )}
    </div>
  );
}
