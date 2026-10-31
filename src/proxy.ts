import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CLIENT_COOKIE, SESSION_COOKIE, verifyClientSessionToken, verifySessionToken } from './lib/auth';

// Read-only endpoints the public site uses
const PUBLIC_API = new Set([
  '/api/settings/sections',
]);

// Portal pages that work without a session
const PUBLIC_PORTAL = new Set(['/portal/login', '/portal/verify']);

// First line of defence only: every admin API route also calls requireAdmin, every portal API route
// calls requireClient, and admin/portal pages that read data check the session themselves.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/portal' || pathname.startsWith('/portal/')) {
    if (PUBLIC_PORTAL.has(pathname)) return NextResponse.next();
    if (await verifyClientSessionToken(request.cookies.get(CLIENT_COOKIE)?.value)) return NextResponse.next();
    return NextResponse.redirect(new URL('/portal/login', request.url));
  }

  if (pathname === '/admin/login') return NextResponse.next();
  if (PUBLIC_API.has(pathname) && request.method === 'GET') return NextResponse.next();
  // Content GETs are public; the route itself decides whether to include hidden items
  if (pathname.startsWith('/api/content/') && request.method === 'GET') return NextResponse.next();

  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 });
  }

  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/content/:path*',
    '/api/settings/:path*',
    '/portal',
    '/portal/:path*',
  ],
};
