import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { rateLimiters } from '@circuitsoul/security';

export async function POST(request: Request) {
  try {
    // Rate limit sign-in attempts
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rl = rateLimiters.signin.check(ip);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many sign-in attempts. Try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const provider = typeof body.provider === 'string' ? body.provider.toLowerCase() : 'custom';

    if (provider === 'clerk') {
      const state = randomBytes(32).toString('base64url');
      const response = NextResponse.json({
        success: true,
        provider: 'clerk',
        signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/api/auth/callback',
        state
      });
      response.cookies.set('circuitsoul_auth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/api/auth/callback'
      });
      return response;
    }

    if (provider === 'custom') {
      return NextResponse.json(
        { success: false, error: 'Custom sign-in is unavailable until credential verification is implemented' },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported sign-in provider' },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Sign-in failed' },
      { status: 400 }
    );
  }
}
