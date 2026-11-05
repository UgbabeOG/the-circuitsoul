import { NextResponse } from 'next/server';
import { getSessionToken, parseSession, refreshSession, verifySessionToken } from '@circuitsoul/auth';

export async function POST(request: Request) {
  try {
    const headers = Object.fromEntries(request.headers.entries());
    const session = parseSession(headers);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No valid session to refresh' },
        { status: 401 }
      );
    }

    const token = getSessionToken(headers);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No session token found' },
        { status: 400 }
      );
    }

    const newToken = await refreshSession(token);
    if (!newToken) {
      return NextResponse.json(
        { success: false, error: 'Session cannot be refreshed (revoked or invalid)' },
        { status: 401 }
      );
    }

    const refreshedSession = verifySessionToken(newToken);
    if (!refreshedSession) {
      throw new Error('Failed to validate refreshed session');
    }

    const response = NextResponse.json({
      success: true,
      token: newToken,
      user: {
        id: refreshedSession.userId,
        email: refreshedSession.email,
        name: refreshedSession.name
      },
      organization: {
        id: refreshedSession.orgId,
        role: refreshedSession.role
      }
    });

    response.cookies.set('circuitsoul_session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Refresh failed' },
      { status: 500 }
    );
  }
}
