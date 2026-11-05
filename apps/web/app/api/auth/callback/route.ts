import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { signSessionToken, verifyProviderToken } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';

function cookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function matchesState(expected: string | null, actual: unknown): boolean {
  if (!expected || typeof actual !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { state?: unknown; token?: unknown };
    if (!matchesState(cookieValue(request, 'circuitsoul_auth_state'), body.state)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired sign-in state' },
        { status: 401 }
      );
    }

    if (typeof body.token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'A provider token is required' },
        { status: 401 }
      );
    }

    const identity = await verifyProviderToken(body.token);
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unverified provider token' },
        { status: 401 }
      );
    }

    let linkedIdentity = await prisma.providerIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: 'CLERK',
          providerSubject: identity.subject
        }
      },
      include: { user: true }
    });

    if (!linkedIdentity) {
      const user = await prisma.user.findUnique({
        where: { email: identity.email }
      });
      if (!user || user.email.toLowerCase() !== identity.email) {
        return NextResponse.json(
          { success: false, error: 'No verified CircuitSoul account is linked to this identity' },
          { status: 403 }
        );
      }

      linkedIdentity = await prisma.providerIdentity.create({
        data: {
          provider: 'CLERK',
          providerSubject: identity.subject,
          emailAtLink: identity.email,
          userId: user.id
        },
        include: { user: true }
      });
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: linkedIdentity.userId,
          organizationId: identity.orgId
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

    const sessionToken = signSessionToken({
      userId: linkedIdentity.user.id,
      email: linkedIdentity.user.email,
      name: linkedIdentity.user.name || undefined,
      orgId: membership.organizationId,
      role: membership.role
    });
    const response = NextResponse.json({
      success: true,
      user: {
        id: linkedIdentity.user.id,
        email: linkedIdentity.user.email,
        name: linkedIdentity.user.name
      },
      organization: {
        id: membership.organizationId,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role
      }
    });
    response.cookies.set('circuitsoul_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });
    response.cookies.set('circuitsoul_auth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/api/auth/callback'
    });
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Callback failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Use the POST callback with state and token in the request body' },
    { status: 405 }
  );
}
