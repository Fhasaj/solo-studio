import type { Metadata } from "next";
import { getAvailability } from "@/lib/booking";
import { GetSiteSettings } from "@/lib/query/settings.query";
import { pageMetadata } from "@/lib/seo";
import PublicShell from "../components/publicShell";
import Breadcrumbs from "../components/breadcrumbs";
import BookingForm from "./bookingForm";

// Free slots change with every booking
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Book a free 20-minute call",
  description:
    "Book a free, no-obligation 20-minute call about custom software for your business. Phone or video, at a time that suits you.",
  path: "/book",
});

export default function BookPage() {
  const settings = GetSiteSettings();
  const days = getAvailability(new Date(), settings);

  return (
    <PublicShell>
      <div className="section-container">
        <Breadcrumbs items={[{ name: "Book a call", path: "/book" }]} />
        <header className="mt-8 max-w-3xl">
          <p className="eyebrow">Free call</p>
          <h1 className="mt-2 text-3xl md:text-5xl font-FiraSans-ExtraBold text-textColour">Book a free {settings.bookingSlotMinutes}-minute call</h1>
          <p className="mt-5 text-lg text-mutedColour">
            Tell me how your business runs today and what&apos;s slowing you down. I&apos;ll tell you honestly whether custom
            software would help and roughly what it would cost. No sales pitch, no obligation.
          </p>
        </header>
        <div className="mt-10">
          <BookingForm days={days} minutes={Number(settings.bookingSlotMinutes)} hasVideoLink={Boolean(settings.bookingVideoLink)} contactEmail={settings.contactEmail} />
        </div>
      </div>
    </PublicShell>
  );
}
