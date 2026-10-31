import Link from "next/link";
import type { CaseStudy } from "@/lib/query/caseStudies.query";
import CaseStudyCard from "../components/cards/caseStudyCard";

export default function CaseStudies({ items }: { items: CaseStudy[] }) {
  if (items.length === 0) return null;

  return (
    <section id="work" className="w-full bg-backgroundColour scroll-mt-20" aria-labelledby="work-heading">
      <div className="section-container">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="eyebrow">Case studies</p>
            <h2 id="work-heading" className="section-title">Work for businesses like yours</h2>
            <p className="mt-4 text-lg text-mutedColour max-w-3xl">
              Real systems in daily use: the problem each business had, what I built, and what changed.
            </p>
          </div>
          <Link href="/work" className="btn-secondary shrink-0">All case studies</Link>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((caseStudy) => (
            <CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} />
          ))}
        </div>
      </div>
    </section>
  );
}
