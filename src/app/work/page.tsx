import type { Metadata } from "next";
import Link from "next/link";
import { ListCaseStudies } from "@/lib/query/caseStudies.query";
import { pageMetadata } from "@/lib/seo";
import PublicShell from "../components/publicShell";
import Breadcrumbs from "../components/breadcrumbs";
import CaseStudyCard from "../components/cards/caseStudyCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Case studies: custom software for UK businesses",
  description:
    "Business systems and apps I've built for construction, security and other UK businesses: the problem, what I built and the results.",
  path: "/work",
});

export default function WorkPage() {
  const caseStudies = ListCaseStudies({ publishedOnly: true });

  return (
    <PublicShell>
      <div className="section-container">
        <Breadcrumbs items={[{ name: "Work", path: "/work" }]} />
        <header className="mt-8 max-w-3xl">
          <p className="eyebrow">Case studies</p>
          <h1 className="mt-2 text-3xl md:text-5xl font-FiraSans-ExtraBold text-textColour">Work for businesses like yours</h1>
          <p className="mt-5 text-lg text-mutedColour">
            Each of these started with a business stuck on spreadsheets, paper or software that didn&apos;t fit.
            Here&apos;s what they needed, what I built and what changed.
          </p>
        </header>

        {caseStudies.length > 0 ? (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {caseStudies.map((caseStudy) => (
              <CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} headingLevel={2} />
            ))}
          </div>
        ) : (
          <p className="mt-12 card p-8 text-mutedColour">
            Case studies are being written up.{" "}
            <Link href="/book" className="text-accentColour underline underline-offset-4">Book a call</Link> and I&apos;ll talk you through recent projects.
          </p>
        )}
      </div>
    </PublicShell>
  );
}
