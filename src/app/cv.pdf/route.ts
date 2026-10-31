import { getCv } from '@/lib/cv';
import { renderCvPdf } from '@/lib/cvPdf';
import { GetSiteSettings } from '@/lib/query/settings.query';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cv = getCv();
  if (!cv) return new Response('Not found', { status: 404 });
  const pdf = await renderCvPdf(GetSiteSettings().cvMarkdown, { title: `CV: ${cv.name}`, author: cv.name });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${cv.fileName}"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
