import { NextResponse } from 'next/server';
import { parseSession, revokeSession } from '@circuitsoul/auth';

export async function POST(request: Request) {
  try {
    const headers = Object.fromEntries(request.headers.entries());
    const session = parseSession(headers);

    if (session) {
      // Extract the token from the Authorization header or cookie
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

      if (token) {
        await revokeSession(token);
      }
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
