import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseSession } from '@circuitsoul/auth';
import { getCsrfCookie, getCsrfHeader, setCsrfCookie, verifyCsrf } from '@circuitsoul/security';
import * as crypto from 'crypto';

const PROTECTED_API_PREFIXES = ['/api/shield', '/api/cloudops', '/api/flow', '/api/blog', '/api/admin'];

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const country = request.headers.get('x-vercel-ip-country') || 'NG';
  const city = request.headers.get('x-vercel-ip-city') || 'Lagos';

  response.headers.set('x-circuitsoul-edge-region', `${country}-${city}`);

  // Always set CSRF cookie so clients can read it and attach to mutation requests
  setCsrfCookie(response, getCsrfCookie(Object.fromEntries(request.headers.entries())) || crypto.randomBytes(32).toString('hex'));

  // CSRF protection for state-changing requests on protected API routes
  const isProtectedApi = PROTECTED_API_PREFIXES.some(prefix => request.nextUrl.pathname.startsWith(prefix));
  if (isProtectedApi && UNSAFE_METHODS.has(request.method)) {
    const csrfError = verifyCsrf(Object.fromEntries(request.headers.entries()), request.method);
    if (csrfError) return csrfError;
  }

  // Session verification for protected API routes
  if (isProtectedApi) {
    const session = parseSession(Object.fromEntries(request.headers.entries()));
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    response.headers.set('x-circuitsoul-user-id', session.userId);
    response.headers.set('x-circuitsoul-org-id', session.orgId);
    response.headers.set('x-circuitsoul-user-role', session.role);
  }

  if (request.nextUrl.pathname === '/') {
    response.headers.set(
      'Cache-Control',
      'public, max-age=60, s-maxage=600, stale-while-revalidate=1200'
    );
  } else {
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  }

  return response;
}

export const config = {
  matcher: ['/', '/((?!api|_next/static|_next/image|favicon.ico).*)', '/api/shield/:path*', '/api/cloudops/:path*', '/api/flow/:path*', '/api/blog/:path*', '/api/admin/:path*']
};
