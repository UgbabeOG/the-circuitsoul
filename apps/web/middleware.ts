import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseSession } from '@circuitsoul/auth';

const PROTECTED_API_PREFIXES = ['/api/shield', '/api/cloudops', '/api/flow', '/api/blog', '/api/admin'];

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const country = request.headers.get('x-vercel-ip-country') || 'NG';
  const city = request.headers.get('x-vercel-ip-city') || 'Lagos';

  response.headers.set('x-circuitsoul-edge-region', `${country}-${city}`);

  // Session verification for protected API routes
  if (PROTECTED_API_PREFIXES.some(prefix => request.nextUrl.pathname.startsWith(prefix))) {
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
