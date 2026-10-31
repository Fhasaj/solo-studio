import Link from "next/link";
import { MdCheck } from "react-icons/md";
import type { SiteSettings } from "@/lib/siteSettings";
import { formatPounds } from "@/lib/format";

export default function Pricing({ settings }: { settings: SiteSettings }) {
  const included = [
    "A fixed quote before any work starts",
    `${settings.depositPercent}% deposit, then pay in stages as work is delivered`,
    "Progress, payments and your contract in one client portal",
    `${settings.supportMonths} months of bug fixes and support after launch`,
  ];
  const plans = [
    { name: "Standard support", price: settings.supportBasicPrice, detail: `Up to ${settings.supportBasicHours} hours a month: fixes, security updates and small changes.` },
    { name: "Priority support", price: settings.supportPriorityPrice, detail: `Up to ${settings.supportPriorityHours} hours a month, and your requests are handled first.` },
  ];

  return (
    <section id="pricing" className="w-full bg-backgroundColour scroll-mt-20" aria-labelledby="pricing-heading">
      <div className="section-container">
        <p className="eyebrow">Pricing</p>
        <h2 id="pricing-heading" className="section-title">
          Projects typically start from <span className="text-accentColour">{formatPounds(settings.pricingFrom)}</span>
        </h2>
        <p className="mt-4 text-lg text-mutedColour max-w-3xl">{settings.pricingNote}</p>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="card p-6 md:p-8 lg:col-span-3">
            <h3 className="text-xl font-FiraSans-Bold text-textColour">Every project includes</h3>
            <ul className="mt-5 space-y-3">
              {included.map((item) => (
                <li key={item} className="flex gap-3 text-mutedColour">
                  <MdCheck className="mt-1 shrink-0 text-successColour" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-mutedColour">
              I can host and look after your system for you from {formatPounds(settings.hostingPrice)} a month (server, backups,
              security updates and monitoring), or hand it over to run on your own hosting. Smaller fixes and changes to existing
              systems are charged at {formatPounds(settings.dayRate)} a day.
            </p>
            <Link href="/book" className="btn-primary mt-6">Get a quote</Link>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className="card p-6">
                <h3 className="font-FiraSans-Bold text-textColour">{plan.name}</h3>
                <p className="mt-2 text-2xl font-FiraSans-ExtraBold text-textColour">
                  {formatPounds(plan.price)}<span className="text-base font-FiraSans-Regular text-mutedColour"> / month</span>
                </p>
                <p className="mt-2 text-sm text-mutedColour">{plan.detail}</p>
              </div>
            ))}
            <p className="text-sm text-mutedColour">Optional, once the included {settings.supportMonths} months of support end.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
