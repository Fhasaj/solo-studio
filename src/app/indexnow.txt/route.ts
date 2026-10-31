import { indexNowKey } from '@/lib/indexNow';

export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(indexNowKey(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
