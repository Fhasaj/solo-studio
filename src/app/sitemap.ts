import type { MetadataRoute } from 'next';
import { ListCaseStudies } from '@/lib/query/caseStudies.query';
import { GetSectionVisibility } from '@/lib/query/settings.query';
import { GetContent } from '@/lib/query/content.query';
import { absoluteUrl } from '@/lib/site';

// Built on each request, so a case study appears as soon as it's published
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const caseStudies = ListCaseStudies({ publishedOnly: true });
  const sections = GetSectionVisibility();
  const latest = caseStudies.map((c) => c.updatedAt).filter(Boolean).sort().at(-1);

  return [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    ...(sections.work ? [{ url: absoluteUrl('/work'), lastModified: latest ?? undefined, changeFrequency: 'weekly' as const, priority: 0.8 }] : []),
    ...caseStudies.map((caseStudy) => ({
      url: absoluteUrl(`/work/${caseStudy.slug}`),
      lastModified: caseStudy.updatedAt ?? undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...(sections.services
      ? GetContent('services')
          .filter((service) => service.details && service.slug)
          .map((service) => ({ url: absoluteUrl(`/services/${service.slug}`), changeFrequency: 'monthly' as const, priority: 0.8 }))
      : []),
    ...GetContent('industries').map((industry) => ({ url: absoluteUrl(`/industries/${industry.slug}`), changeFrequency: 'monthly' as const, priority: 0.7 })),
    { url: absoluteUrl('/book'), changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.2 },
    ...(sections.cv ? [{ url: absoluteUrl('/cv'), changeFrequency: 'yearly' as const, priority: 0.3 }] : []),
  ];
}
