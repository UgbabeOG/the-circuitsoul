import { NextResponse } from 'next/server';
import { parseProviderToken, signSessionToken } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';

function getVerifiedEmail(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      email?: unknown;
      email_verified?: unknown;
    };

    if (
      typeof payload.email !== 'string' ||
      payload.email.trim() === '' ||
      payload.email_verified !== true
    ) {
      return null;
    }

    return payload.email.trim();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'A verified provider token is required' },
        { status: 401 }
      );
    }

    if ((process.env.AUTH_PROVIDER || 'custom').toLowerCase() !== 'clerk') {
      return NextResponse.json(
        { success: false, error: 'Verified provider sign-in is not configured' },
        { status: 503 }
      );
    }

    const verified = parseProviderToken(token);
    const email = getVerifiedEmail(token);
    if (!verified || !email) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unverified provider token' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No matching account found' },
        { status: 403 }
      );
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: verified.orgId
        }
      },
      include: { organization: true }
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'No membership found for this account and organization' },
        { status: 403 }
      );
    }

    const tokenString = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name || undefined,
      orgId: membership.organizationId,
      role: membership.role
    });

    const response = NextResponse.json({
      success: true,
      token: tokenString,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      organization: {
        id: membership.organizationId,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role
      }
    });

    response.cookies.set('circuitsoul_session', tokenString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Callback failed' },
      { status: 500 }
    );
  }
}
