import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPortalClient } from "@/lib/session";
import { GetSiteSettings } from "@/lib/query/settings.query";
import SignOutButton from "./components/signOutButton";

export const metadata: Metadata = {
  title: { default: "Client portal", template: "%s · Client portal" },
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const client = await getPortalClient();

  return (
    <div className="bg-backgroundColour min-h-screen text-textColour flex flex-col">
      <header className="border-b border-borderColour no-print">
        <div className="w-full max-w-5xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between gap-4">
          <Link href={client ? "/portal" : "/"} className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="" width={32} height={32} sizes="32px" style={{ height: "auto" }} />
            <span className="font-FiraSans-Bold">{GetSiteSettings().siteName} <span className="text-mutedColour font-FiraSans-Regular">· Client portal</span></span>
          </Link>
          {client && (
            <div className="flex items-center gap-4 text-sm">
              <span className="hidden sm:inline text-mutedColour">{client.name}</span>
              <SignOutButton />
            </div>
          )}
        </div>
      </header>
      <main className="flex-grow w-full max-w-5xl mx-auto px-5 md:px-8 py-10">{children}</main>
    </div>
  );
}
