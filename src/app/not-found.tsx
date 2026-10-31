import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "./components/navigation";
import Footer from "./components/footer";
import { SECTION_DEFAULTS } from "@/lib/sections";
import { GetSiteSettings } from "@/lib/query/settings.query";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  const settings = GetSiteSettings();
  return (
    <div className="bg-backgroundColour min-h-screen text-textColour flex flex-col">
      <Navigation sections={{ ...SECTION_DEFAULTS }} brand={settings.siteName} />
      <main className="flex-grow section-container text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-3xl md:text-5xl font-FiraSans-ExtraBold">Page not found</h1>
        <p className="mt-5 text-lg text-mutedColour">That page doesn&apos;t exist or has moved.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/" className="btn-primary">Go to the homepage</Link>
          <Link href="/work" className="btn-secondary">See case studies</Link>
        </div>
      </main>
      <Footer settings={settings} />
    </div>
  );
}
