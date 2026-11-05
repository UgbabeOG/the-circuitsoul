import { NextResponse } from 'next/server';
import { getSessionToken, revokeSession } from '@circuitsoul/auth';

export async function POST(request: Request) {
  try {
    const headers = Object.fromEntries(request.headers.entries());
    const token = getSessionToken(headers);
    if (token) {
      await revokeSession(token);
    }

    const response = NextResponse.json({ success: true, message: 'Logged out' });
    response.cookies.set('circuitsoul_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Logout failed' },
      { status: 500 }
    );
  }
}
