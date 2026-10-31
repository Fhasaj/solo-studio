import Link from "next/link";
import { MdOutlineLocationOn, MdOutlinePhoneInTalk } from "react-icons/md";
import type { SiteSettings } from "@/lib/siteSettings";

const steps = [
  { title: "Free 20-minute call", text: "Tell me how things work today and what's getting in the way." },
  { title: "Fixed quote and contract", text: "A clear price and plan before any work starts. No surprises." },
  { title: "Built in stages", text: "Follow progress in your own client portal and pay as each stage is delivered." },
];

export default function Hero({ settings, hasWork }: { settings: SiteSettings; hasWork: boolean }) {
  const allSteps = [...steps, { title: "Launch and support", text: `I host it if you'd like, train your team and fix any issues for ${settings.supportMonths} months.` }];
  const highlights = [
    { value: `Since ${settings.freelancingSince}`, label: "Freelancing for businesses" },
    { value: "Fixed", label: "Quotes agreed before work starts" },
    { value: "Staged", label: "Payments, tracked in your client portal" },
    { value: `${settings.supportMonths} months`, label: "Support included after launch" },
  ];

  return (
    <section className="w-full bg-backgroundColour" aria-labelledby="hero-heading">
      <div className="section-container pt-16! md:pt-24!">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
          <div className="lg:col-span-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-borderColour bg-backgroundColour px-3 py-1 text-xs md:text-sm text-mutedColour">
              <MdOutlineLocationOn className="shrink-0 text-accentColour" aria-hidden />
              {settings.heroBadge}
            </p>
            <h1 id="hero-heading" className="mt-6 text-4xl md:text-6xl font-FiraSans-ExtraBold leading-tight text-textColour">
              {settings.heroHeadline}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-mutedColour font-FiraSans-Regular max-w-2xl">
              {settings.heroSubheading}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/book" className="btn-primary">
                <MdOutlinePhoneInTalk className="text-xl" aria-hidden />
                Book a free 20-minute call
              </Link>
              {hasWork ? (
                <Link href="#work" className="btn-secondary">See my work</Link>
              ) : (
                <Link href="#services" className="btn-secondary">See what I build</Link>
              )}
            </div>
            <p className="mt-4 text-sm text-mutedColour">No obligation. Phone or video, whichever suits you.</p>
          </div>

          <div className="lg:col-span-2">
            <div className="card p-6 md:p-8">
              <h2 className="text-lg font-FiraSans-Bold text-textColour">How it works</h2>
              <ol className="mt-5 space-y-5">
                {allSteps.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accentColour/15 text-accentColour font-FiraSans-Bold" aria-hidden>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-FiraSans-SemiBold text-textColour">{step.title}</p>
                      <p className="text-sm text-mutedColour">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <ul className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          {highlights.map((item) => (
            <li key={item.label} className="card p-5">
              <p className="text-2xl md:text-3xl font-FiraSans-ExtraBold text-accentColour">{item.value}</p>
              <p className="mt-1 text-sm text-mutedColour">{item.label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
