import Image from "next/image";
import Link from "next/link";
import { MdOutlinePhoneInTalk } from "react-icons/md";
import type { CaseStudy } from "@/lib/query/caseStudies.query";
import type { ContentRow } from "@/lib/content";
import RichText from "@/lib/richText";
import Breadcrumbs from "../components/breadcrumbs";
import CaseStudyCard from "../components/cards/caseStudyCard";

interface CaseStudyViewProps {
  caseStudy: CaseStudy;
  testimonials: ContentRow[];
  related?: CaseStudy[];
}

// The case study page body. Also used by the admin preview, so drafts look exactly as they will when published.
export default function CaseStudyView({ caseStudy, testimonials, related = [] }: CaseStudyViewProps) {
  const sections = [
    { id: "problem", title: "The problem", text: caseStudy.problem },
    { id: "solution", title: "What I built", text: caseStudy.solution },
    { id: "results", title: "Results", text: caseStudy.results },
  ].filter((section) => section.text);

  const facts = [
    { label: "Client", value: caseStudy.clientName },
    { label: "Industry", value: caseStudy.industry },
  ].filter((fact) => fact.value);

  return (
    <article className="w-full">
      <div className="section-container pb-0!">
        <Breadcrumbs items={[{ name: "Work", path: "/work" }, { name: caseStudy.title, path: `/work/${caseStudy.slug}` }]} />

        <header className="mt-8 max-w-4xl">
          {caseStudy.industry && <p className="eyebrow">{caseStudy.industry}</p>}
          <h1 className="mt-2 text-3xl md:text-5xl font-FiraSans-ExtraBold leading-tight text-textColour">{caseStudy.title}</h1>
          {caseStudy.summary && <p className="mt-5 text-lg md:text-xl text-mutedColour">{caseStudy.summary}</p>}
        </header>

        <dl className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {facts.map((fact) => (
            <div key={fact.label} className="card p-4">
              <dt className="text-xs uppercase tracking-wider text-mutedColour">{fact.label}</dt>
              <dd className="mt-1 font-FiraSans-SemiBold text-textColour">{fact.value}</dd>
            </div>
          ))}
          {caseStudy.tech.length > 0 && (
            <div className={`card p-4 ${facts.length < 2 ? "sm:col-span-2" : ""}`}>
              <dt className="text-xs uppercase tracking-wider text-mutedColour">Tech stack</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {caseStudy.tech.map((tech) => (
                  <span key={tech} className="chip">{tech}</span>
                ))}
              </dd>
            </div>
          )}
        </dl>

        {caseStudy.cover && (
          <Image
            src={caseStudy.cover.src}
            alt={caseStudy.cover.alt}
            width={caseStudy.cover.width}
            height={caseStudy.cover.height}
            sizes="(min-width: 1152px) 1088px, 100vw"
            preload
            className="mt-10 w-full h-auto rounded-xl border border-borderColour"
          />
        )}
      </div>

      <div className="section-container">
        <div className="max-w-3xl space-y-14">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={`${section.id}-heading`}>
              <h2 id={`${section.id}-heading`} className="text-2xl md:text-3xl font-FiraSans-ExtraBold text-textColour">{section.title}</h2>
              <RichText text={section.text} className="mt-4 space-y-4 text-lg text-mutedColour leading-relaxed" />
            </section>
          ))}
        </div>

        {caseStudy.gallery.length > 0 && (
          <section className="mt-14" aria-labelledby="gallery-heading">
            <h2 id="gallery-heading" className="text-2xl md:text-3xl font-FiraSans-ExtraBold text-textColour">Screenshots</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {caseStudy.gallery.map((image) => (
                <Image
                  key={image.src}
                  src={image.src}
                  alt={image.alt}
                  width={image.width}
                  height={image.height}
                  sizes="(min-width: 1152px) 532px, (min-width: 768px) 50vw, 100vw"
                  className="w-full h-auto rounded-xl border border-borderColour"
                />
              ))}
            </div>
          </section>
        )}

        {testimonials.map((testimonial) => (
          <figure key={testimonial.id} className="mt-14 card p-8 max-w-3xl">
            <blockquote className="text-xl text-textColour leading-relaxed">
              <p>&ldquo;{testimonial.quote}&rdquo;</p>
            </blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-FiraSans-Bold text-textColour">{testimonial.name}</span>
              {testimonial.role && <span className="text-mutedColour">, {testimonial.role}</span>}
            </figcaption>
          </figure>
        ))}

        <aside className="mt-16 card p-8 md:p-10 border-accentColour/50" aria-labelledby="cta-heading">
          <h2 id="cta-heading" className="text-2xl md:text-3xl font-FiraSans-ExtraBold text-textColour">Dealing with something similar?</h2>
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

        {related.length > 0 && (
          <section className="mt-16" aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-2xl font-FiraSans-ExtraBold text-textColour">More case studies</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {related.map((item) => (
                <CaseStudyCard key={item.id} caseStudy={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
