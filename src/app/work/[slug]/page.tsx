import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { FindCaseStudyRedirect, GetPublishedCaseStudyBySlug, ListCaseStudies } from "@/lib/query/caseStudies.query";
import { GetContent } from "@/lib/query/content.query";
import { caseStudySchema, JsonLd, pageMetadata } from "@/lib/seo";
import PublicShell from "../../components/publicShell";
import CaseStudyView from "../caseStudyView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Drafts 404; renamed case studies 301 to their new address
function loadCaseStudy(slug: string) {
  const caseStudy = GetPublishedCaseStudyBySlug(slug);
  if (caseStudy) return caseStudy;
  const newSlug = FindCaseStudyRedirect(slug);
  if (newSlug) permanentRedirect(`/work/${newSlug}`);
  notFound();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const caseStudy = loadCaseStudy((await params).slug);
  return pageMetadata({
    title: caseStudy.seoTitle || caseStudy.title,
    description: caseStudy.seoDescription || caseStudy.summary,
    path: `/work/${caseStudy.slug}`,
    image: caseStudy.cover ? { url: caseStudy.cover.src, width: caseStudy.cover.width, height: caseStudy.cover.height, alt: caseStudy.cover.alt } : undefined,
  });
}

export default async function CaseStudyPage({ params }: PageProps) {
  const caseStudy = loadCaseStudy((await params).slug);
  const testimonials = GetContent("testimonials").filter((testimonial) => testimonial.caseStudyId === String(caseStudy.id));
  const related = ListCaseStudies({ publishedOnly: true }).filter((item) => item.id !== caseStudy.id).slice(0, 2);

  return (
    <PublicShell>
      <JsonLd data={caseStudySchema(caseStudy)} />
      <CaseStudyView caseStudy={caseStudy} testimonials={testimonials} related={related} />
    </PublicShell>
  );
}
