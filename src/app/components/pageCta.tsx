import Link from "next/link";
import { MdOutlinePhoneInTalk } from "react-icons/md";

// The "book a call" block at the end of service, industry and case study pages
export default function PageCta({ heading = "Want to talk it through?" }: { heading?: string }) {
  return (
    <aside className="mt-16 card p-8 md:p-10 border-accentColour/50" aria-labelledby="cta-heading">
      <h2 id="cta-heading" className="text-2xl md:text-3xl font-FiraSans-ExtraBold text-textColour">{heading}</h2>
      <p className="mt-3 text-lg text-mutedColour max-w-2xl">
        Tell me how your business runs today. In 20 minutes we&apos;ll work out whether custom software would help, and roughly what it would cost.
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        <Link href="/book" className="btn-primary">
          <MdOutlinePhoneInTalk className="text-xl" aria-hidden />
          Book a free 20-minute call
        </Link>
        <Link href="/#contact-me" className="btn-secondary">Send a message</Link>
      </div>
    </aside>
  );
}
