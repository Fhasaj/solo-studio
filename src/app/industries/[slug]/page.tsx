import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GetContent, GetContentBySlug } from "@/lib/query/content.query";
import { ListCaseStudies } from "@/lib/query/caseStudies.query";
import { splitLines } from "@/lib/content";
import { JsonLd, pageMetadata, serviceSchema } from "@/lib/seo";
import RichText from "@/lib/richText";
import PublicShell from "../../components/publicShell";
import Breadcrumbs from "../../components/breadcrumbs";
import CaseStudyCard from "../../components/cards/caseStudyCard";
import PageCta from "../../components/pageCta";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function loadIndustry(slug: string) {
  const industry = GetContentBySlug("industries", slug);
  if (!industry) notFound();
  return industry;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const industry = loadIndustry((await params).slug);
  return pageMetadata({
    title: `Custom software for ${String(industry.name).toLowerCase()}`,
    description: String(industry.seoDescription || industry.intro),
    path: `/industries/${industry.slug}`,
  });
}

export default async function IndustryPage({ params }: PageProps) {
  const industry = loadIndustry((await params).slug);
  const match = String(industry.matchIndustry || industry.name).toLowerCase();
  const caseStudies = ListCaseStudies({ publishedOnly: true }).filter((c) => c.industry.toLowerCase().includes(match));
  const problems = splitLines(industry.problems);
  const services = GetContent("services").filter((s) => s.details);
  const others = GetContent("industries").filter((i) => i.id !== industry.id);

  return (
    <PublicShell>
      <JsonLd data={serviceSchema({ name: `Custom software for ${industry.name}`, description: String(industry.intro), path: `/industries/${industry.slug}` })} />
      <article className="section-container">
        <Breadcrumbs items={[{ name: String(industry.name), path: `/industries/${industry.slug}` }]} />
        <header className="mt-8 max-w-3xl">
          <p className="eyebrow">Industries</p>
          <h1 className="mt-2 text-3xl md:text-5xl font-FiraSans-ExtraBold leading-tight text-textColour">Custom software for {String(industry.name).toLowerCase()}</h1>
          <p className="mt-5 text-lg md:text-xl text-mutedColour">{industry.intro}</p>
        </header>

        {problems.length > 0 && (
          <section className="mt-12 card p-6 md:p-8 max-w-3xl" aria-labelledby="problems-heading">
            <h2 id="problems-heading" className="text-xl font-FiraSans-Bold text-textColour">Sound familiar?</h2>
            <ul className="mt-4 space-y-2 text-mutedColour list-disc pl-5 marker:text-accentColour">
              {problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          </section>
        )}

        {industry.details && (
          <RichText text={String(industry.details)} headingLevel={2} className="mt-12 max-w-3xl space-y-4 text-lg text-mutedColour leading-relaxed [&_h2]:text-2xl [&_h2]:pt-4" />
        )}

        {caseStudies.length > 0 && (
          <section className="mt-16" aria-labelledby="cases-heading">
            <h2 id="cases-heading" className="text-2xl font-FiraSans-ExtraBold text-textColour">Work in this industry</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">{caseStudies.map((c) => <CaseStudyCard key={c.id} caseStudy={c} />)}</div>
          </section>
        )}

        {services.length > 0 && (
          <section className="mt-16" aria-labelledby="services-heading">
            <h2 id="services-heading" className="text-2xl font-FiraSans-ExtraBold text-textColour">How I can help</h2>
            <ul className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {services.map((service) => (
                <li key={service.id} className="card p-5">
                  <Link href={`/services/${service.slug}`} className="font-FiraSans-Bold text-textColour hover:text-accentColour">{service.title}</Link>
                  <p className="mt-2 text-sm text-mutedColour">{service.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <PageCta />

        {others.length > 0 && (
          <nav aria-label="Other industries" className="mt-12 text-sm">
            <span className="text-mutedColour">Also working with: </span>
            {others.map((i, index) => (
              <span key={i.id}>
                {index > 0 && " · "}
                <Link href={`/industries/${i.slug}`} className="text-accentColour hover:underline">{i.name}</Link>
              </span>
            ))}
          </nav>
        )}
      </article>
    </PublicShell>
  );
}
