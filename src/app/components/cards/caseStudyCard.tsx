import Image from "next/image";
import Link from "next/link";
import type { CaseStudy } from "@/lib/query/caseStudies.query";

export default function CaseStudyCard({ caseStudy, headingLevel = 3 }: { caseStudy: CaseStudy; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <article className="card overflow-hidden flex flex-col hover:border-accentColour/60 group relative">
      {caseStudy.cover && (
        <Image
          src={caseStudy.cover.src}
          alt={caseStudy.cover.alt}
          width={caseStudy.cover.width}
          height={caseStudy.cover.height}
          sizes="(min-width: 1152px) 544px, (min-width: 768px) 50vw, 100vw"
          className="w-full aspect-[16/9] object-cover border-b border-borderColour"
        />
      )}
      <div className="p-6 flex flex-col flex-grow">
        {caseStudy.industry && <p className="text-xs uppercase tracking-wider text-accentColour font-FiraSans-SemiBold">{caseStudy.industry}</p>}
        <Heading className="mt-2 text-xl font-FiraSans-Bold text-textColour">
          {/* The link covers the whole card; its text is the title, so it reads well out of context */}
          <Link href={`/work/${caseStudy.slug}`} className="after:absolute after:inset-0 group-hover:text-accentColour hover:cursor-finger">
            {caseStudy.title}
          </Link>
        </Heading>
        <p className="mt-3 text-mutedColour flex-grow">{caseStudy.summary}</p>
        {caseStudy.tech.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Tech stack">
            {caseStudy.tech.slice(0, 5).map((tech) => (
              <li key={tech} className="chip">{tech}</li>
            ))}
          </ul>
        )}
        <p className="mt-5 text-sm font-FiraSans-SemiBold text-accentColour" aria-hidden>Read the case study →</p>
      </div>
    </article>
  );
}
