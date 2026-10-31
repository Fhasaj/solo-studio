import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GetContent, GetContentBySlug } from "@/lib/query/content.query";
import { ListCaseStudies } from "@/lib/query/caseStudies.query";
import { GetSectionVisibility } from "@/lib/query/settings.query";
import { splitLines, splitTags } from "@/lib/content";
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

// Only services with full page text get a page
function loadService(slug: string) {
  const service = GetSectionVisibility().services ? GetContentBySlug("services", slug) : null;
  if (!service || !service.details) notFound();
  return service;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const service = loadService((await params).slug);
  return pageMetadata({
    title: `${service.title} for UK businesses`,
    description: String(service.seoDescription || service.description),
    path: `/services/${service.slug}`,
  });
}

export default async function ServicePage({ params }: PageProps) {
  const service = loadService((await params).slug);
  const tech = splitTags(service.tech);
  // Case studies that used this service's tech, as proof
  const related = ListCaseStudies({ publishedOnly: true })
    .filter((c) => c.tech.some((t) => tech.some((s) => s.toLowerCase() === t.toLowerCase())))
    .slice(0, 2);
  const others = GetContent("services").filter((s) => s.id !== service.id && s.details);

  return (
    <PublicShell>
      <JsonLd data={serviceSchema({ name: String(service.title), description: String(service.description), path: `/services/${service.slug}` })} />
      <article className="section-container">
        <Breadcrumbs items={[{ name: String(service.title), path: `/services/${service.slug}` }]} />
        <header className="mt-8 max-w-3xl">
          <p className="eyebrow">Services</p>
          <h1 className="mt-2 text-3xl md:text-5xl font-FiraSans-ExtraBold leading-tight text-textColour">{service.title}</h1>
          {service.description && <p className="mt-5 text-lg md:text-xl text-mutedColour">{service.description}</p>}
          {service.priceFrom && <p className="mt-4 font-FiraSans-SemiBold text-textColour">{service.priceFrom}</p>}
        </header>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <RichText text={String(service.details)} headingLevel={2} className="lg:col-span-2 space-y-4 text-lg text-mutedColour leading-relaxed [&_h2]:text-2xl [&_h2]:pt-4" />
          <aside className="flex flex-col gap-6">
            {splitLines(service.examples).length > 0 && (
              <div className="card p-6">
                <h2 className="font-FiraSans-Bold text-textColour">Examples</h2>
                <ul className="mt-3 space-y-2 text-sm text-mutedColour list-disc pl-5 marker:text-accentColour">
                  {splitLines(service.examples).map((example) => <li key={example}>{example}</li>)}
                </ul>
              </div>
            )}
            {tech.length > 0 && (
              <div className="card p-6">
                <h2 className="font-FiraSans-Bold text-textColour">Built with</h2>
                <div className="mt-3 flex flex-wrap gap-2">{tech.map((t) => <span key={t} className="chip">{t}</span>)}</div>
              </div>
            )}
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-16" aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-2xl font-FiraSans-ExtraBold text-textColour">Related work</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">{related.map((c) => <CaseStudyCard key={c.id} caseStudy={c} />)}</div>
          </section>
        )}

        <PageCta />

        {others.length > 0 && (
          <nav aria-label="Other services" className="mt-12 text-sm">
            <span className="text-mutedColour">Other services: </span>
            {others.map((s, i) => (
              <span key={s.id}>
                {i > 0 && " · "}
                <Link href={`/services/${s.slug}`} className="text-accentColour hover:underline">{s.title}</Link>
              </span>
            ))}
          </nav>
        )}
      </article>
    </PublicShell>
  );
}
