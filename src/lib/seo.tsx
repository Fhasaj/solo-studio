/*
 * @name: SEO
 * @description: Structured data (JSON-LD) for search engines and shared page metadata helpers.
 * */

import type { Metadata } from "next";
import type { ContentRow } from "./content";
import type { CaseStudy } from "./query/caseStudies.query";
import { GetSiteSettings } from "./query/settings.query";
import type { SiteSettings } from "./siteSettings";
import { absoluteUrl, SITE_URL } from "./site";
import { formatPounds } from "./format";

export const DEFAULT_OG_IMAGE = { url: "/images/og-image.png", width: 1200, height: 630, alt: "Custom software for small businesses" };

const PERSON_ID = `${SITE_URL}/#person`;
const BUSINESS_ID = `${SITE_URL}/#business`;

// JSON.stringify doesn't escape "<", so "</script>" in content could end the tag early
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

// "BSc Computer Science | University of London" lines → { name, school }
function qualifications(settings: SiteSettings) {
  return settings.qualifications
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter(([name]) => name)
    .map(([name, school]) => ({ name, school: school ?? "" }));
}

export function homeSchema(settings: SiteSettings, description: string) {
  const address = { "@type": "PostalAddress", addressLocality: settings.town, addressRegion: settings.region || undefined, addressCountry: "GB" };
  const sameAs = [settings.githubUrl, settings.linkedinUrl].filter(Boolean);
  const quals = qualifications(settings);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: settings.ownerName,
        url: SITE_URL,
        image: settings.aboutImage ? absoluteUrl(settings.aboutImage) : undefined,
        jobTitle: "Freelance software developer",
        address,
        sameAs,
        // Background and skills help search engines and AI answers judge expertise
        alumniOf: quals.filter((q) => q.school).map((q) => ({ "@type": "CollegeOrUniversity", name: q.school })),
        hasCredential: quals.map((q) => ({ "@type": "EducationalOccupationalCredential", name: q.name })),
        knowsAbout: list(settings.knowsAbout),
        worksFor: { "@id": BUSINESS_ID },
      },
      {
        "@type": "ProfessionalService",
        "@id": BUSINESS_ID,
        name: settings.siteName,
        url: SITE_URL,
        description,
        image: absoluteUrl(DEFAULT_OG_IMAGE.url),
        logo: absoluteUrl("/images/logo.png"),
        email: settings.contactEmail || undefined,
        telephone: settings.contactPhone || undefined,
        priceRange: settings.pricingFrom ? `From ${formatPounds(settings.pricingFrom)}` : undefined,
        address,
        areaServed: list(settings.areaServed).map((name) => ({ "@type": "Country", name })),
        founder: { "@id": PERSON_ID },
        sameAs,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: settings.siteName,
        inLanguage: "en-GB",
        publisher: { "@id": BUSINESS_ID },
      },
    ],
  };
}

export function caseStudySchema(caseStudy: CaseStudy) {
  const url = absoluteUrl(`/work/${caseStudy.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: caseStudy.title,
    description: caseStudy.seoDescription || caseStudy.summary,
    url,
    mainEntityOfPage: url,
    image: caseStudy.cover ? absoluteUrl(caseStudy.cover.src) : absoluteUrl(DEFAULT_OG_IMAGE.url),
    datePublished: caseStudy.publishedAt ?? undefined,
    dateModified: caseStudy.updatedAt ?? caseStudy.publishedAt ?? undefined,
    author: { "@type": "Person", "@id": PERSON_ID, name: GetSiteSettings().ownerName, url: SITE_URL },
    publisher: { "@type": "Organization", "@id": BUSINESS_ID, name: GetSiteSettings().siteName, url: SITE_URL },
    about: caseStudy.industry || undefined,
    keywords: caseStudy.tech.length ? caseStudy.tech.join(", ") : undefined,
    inLanguage: "en-GB",
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

// Canonical, Open Graph and Twitter tags for a public page
export function pageMetadata({ title, description, path, image }: { title: string; description: string; path: string; image?: { url: string; width?: number; height?: number; alt: string } }): Metadata {
  const images = [image ?? DEFAULT_OG_IMAGE];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: GetSiteSettings().siteName, locale: "en_GB", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
  };
}

export function faqSchema(faqs: ContentRow[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: String(faq.question),
      acceptedAnswer: { "@type": "Answer", text: String(faq.answer) },
    })),
  };
}

export function serviceSchema({ name, description, path }: { name: string; description: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url: absoluteUrl(path),
    serviceType: name,
    provider: { "@id": BUSINESS_ID },
    areaServed: list(GetSiteSettings().areaServed).map((name) => ({ "@type": "Country", name })),
  };
}
