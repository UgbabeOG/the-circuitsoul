import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = typeof body.provider === 'string' ? body.provider.toLowerCase() : 'custom';

    if (provider === 'clerk') {
      return NextResponse.json({
        success: true,
        provider: 'clerk',
        signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/api/auth/callback'
      });
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
