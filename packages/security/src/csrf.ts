import { NextResponse } from 'next/server';

import * as crypto from 'crypto';

const CSRF_COOKIE_NAME = 'circuitsoul_csrf';
const CSRF_HEADER_NAME = 'x-circuitsoul-csrf';

/**
 * Generates a cryptographically strong CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Sets the CSRF token cookie on the response.
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // readable by JS to attach to requests
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });
}

/**
 * Reads the CSRF token from the request cookies.
 */
export function getCsrfCookie(headers: Record<string, string | undefined>): string | null {
  const cookieHeader = headers['cookie'] || headers['Cookie'];
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * Reads the CSRF token from the request header.
 */
export function getCsrfHeader(headers: Record<string, string | undefined>): string | null {
  return headers[CSRF_HEADER_NAME] || headers[CSRF_HEADER_NAME.toLowerCase()] || null;
}

/**
 * Verifies the CSRF token from the request matches the cookie.
 * Returns null if valid, or a NextResponse error if invalid/missing.
 */
export function verifyCsrf(
  headers: Record<string, string | undefined>,
  method: string
): NextResponse | null {
  // Only enforce on state-changing methods
  const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  if (!unsafeMethods.has(method)) return null;

  const cookieToken = getCsrfCookie(headers);
  const headerToken = getCsrfHeader(headers);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json(
      { success: false, error: 'CSRF token missing or mismatched' },
      { status: 403 }
    );
  }
  return null;
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
