import type { Metadata } from "next";
import { GetSiteSettings } from "@/lib/query/settings.query";
import { pageMetadata } from "@/lib/seo";
import PublicShell from "../components/publicShell";
import Breadcrumbs from "../components/breadcrumbs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Privacy notice",
  description: "How we collect, uses and protects personal data from the contact form, call bookings and the client portal.",
  path: "/privacy",
});

export default function PrivacyPage() {
  const settings = GetSiteSettings();
  const sections = [
    {
      title: "Who I am",
      body: [
        `This site is run by ${settings.businessName}, a sole trader based in ${settings.town}, UK. I am the data controller for the personal data described here. You can contact me about it at ${settings.contactEmail}.`,
      ],
    },
    {
      title: "What I collect and why",
      body: [
        "Contact form: your name, email address and message, so I can reply to you. The lawful basis is my legitimate interest in responding to enquiries.",
        "Call bookings: your name, email, phone number, business name, industry and anything you tell me about your project, so I can hold the call and follow up. The lawful basis is taking steps at your request before entering into a contract.",
        "Client portal: your name, email, business details, project information and payment records, so I can deliver the project and keep accounts. The lawful basis is performing our contract and my legal obligation to keep financial records.",
        "Contract signatures: the name you type, the time, your IP address and browser, and a fingerprint of the exact contract text, so there is a reliable record of what was agreed. The lawful basis is performing our contract and my legitimate interest in being able to prove it.",
      ],
    },
    {
      title: "Cookies",
      body: [
        "This site only uses cookies that are needed for it to work: one keeps you signed in to the client portal. There are no advertising or analytics cookies, so there is no cookie banner.",
      ],
    },
    {
      title: "Who I share it with",
      body: [
        "I don't sell or share your data for marketing. It is stored on a server I manage and passes through my email provider when I send you emails. Those providers process it only on my instructions.",
      ],
    },
    {
      title: "How long I keep it",
      body: [
        "Enquiries and booking details are kept for up to 12 months if we don't go on to work together. Project, contract and payment records are kept for 6 years after the project ends, as required for tax and legal purposes.",
      ],
    },
    {
      title: "Your rights",
      body: [
        `You can ask for a copy of your data, ask me to correct or delete it, or object to how I use it, by emailing ${settings.contactEmail}. I'll reply within one month.`,
        "If you're unhappy with how I've handled your data, you can complain to the Information Commissioner's Office (ico.org.uk).",
      ],
    },
  ];

  return (
    <PublicShell>
      <div className="section-container max-w-3xl!">
        <Breadcrumbs items={[{ name: "Privacy", path: "/privacy" }]} />
        <h1 className="mt-8 text-3xl md:text-5xl font-FiraSans-ExtraBold text-textColour">Privacy notice</h1>
        <div className="mt-8 space-y-10 text-mutedColour leading-relaxed">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-FiraSans-Bold text-textColour">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
