import { NextResponse } from 'next/server';
import { parseSession, refreshSession } from '@circuitsoul/auth';

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

    // Extract the current token
    const authHeader = headers['authorization'] || headers['Authorization'];
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    } else {
      const cookieHeader = headers['cookie'] || headers['Cookie'];
      if (cookieHeader) {
        const match = cookieHeader.match(/circuitsoul_session=([^;]+)/);
        if (match && match[1]) {
          token = decodeURIComponent(match[1]);
        }
      }
    }

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

    const response = NextResponse.json({
      success: true,
      token: newToken,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name
      },
      organization: {
        id: session.orgId,
        role: session.role
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
