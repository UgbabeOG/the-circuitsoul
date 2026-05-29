import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const country = request.headers.get('x-vercel-ip-country') || 'NG';
  const city = request.headers.get('x-vercel-ip-city') || 'Lagos';
  
  response.headers.set('x-circuitsoul-edge-region', `${country}-${city}`);

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
  matcher: ['/', '/((?!api|_next/static|_next/image|favicon.ico).*)']
};
