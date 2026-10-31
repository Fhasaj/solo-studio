import { GetContent } from '@/lib/query/content.query';
import { ListCaseStudies } from '@/lib/query/caseStudies.query';
import { GetSiteSettings } from '@/lib/query/settings.query';
import { formatPounds } from '@/lib/format';
import { absoluteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

// A plain summary for AI tools (the llms.txt convention), built from the same content as the site
export function GET() {
  const settings = GetSiteSettings();
  const services = GetContent('services');
  const industries = GetContent('industries');
  const caseStudies = ListCaseStudies({ publishedOnly: true });
  const faqs = GetContent('faqs');
  const link = (title: unknown, path: string, note?: unknown) => `- [${title}](${absoluteUrl(path)})${note ? `: ${note}` : ''}`;

  const sections = [
    `# ${settings.siteName}`,
    `> ${settings.heroHeadline}. ${settings.heroSubheading}`,
    `${settings.ownerName} is a freelance software developer based in ${settings.town}, working with businesses in ${settings.areaServed}. Projects typically start from ${formatPounds(settings.pricingFrom)}, with a fixed quote after a free call.`,
    '## Services',
    services.map((s) => (s.details ? link(s.title, `/services/${s.slug}`, s.description) : `- ${s.title}: ${s.description}`)).join('\n'),
    industries.length ? '## Industries' : '',
    industries.map((i) => link(i.name, `/industries/${i.slug}`, i.intro)).join('\n'),
    caseStudies.length ? '## Case studies' : '',
    caseStudies.map((c) => link(c.title, `/work/${c.slug}`, c.summary)).join('\n'),
    faqs.length ? '## Common questions' : '',
    faqs.map((f) => `### ${f.question}\n${f.answer}`).join('\n\n'),
    '## Contact',
    [link('Book a free 20-minute call', '/book'), settings.contactEmail ? `- Email: ${settings.contactEmail}` : '', link('Privacy notice', '/privacy')].filter(Boolean).join('\n'),
  ];

  return new Response(sections.filter(Boolean).join('\n\n') + '\n', {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
