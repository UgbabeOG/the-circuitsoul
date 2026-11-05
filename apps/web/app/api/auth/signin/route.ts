import { NextResponse } from 'next/server';
import { signSessionToken } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, provider = 'custom' } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const authProvider = provider.toLowerCase();

    if (authProvider === 'clerk') {
      // For Clerk, return the sign-in URL so the client can redirect
      return NextResponse.json({
        success: true,
        provider: 'clerk',
        signInUrl: `${process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/api/auth/callback'}?email=${encodeURIComponent(email)}`
      });
    }

    // Custom provider: find or create user and issue session
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: email.split('@')[0] }
      });
    }

    // Get user's memberships for org context
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { organization: true }
    });

    if (memberships.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No organization memberships found for this user' },
        { status: 403 }
      );
    }

    // Default to the first membership (oldest created)
    const defaultOrg = memberships[0];

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name || undefined,
      orgId: defaultOrg.organizationId,
      role: defaultOrg.role
    });

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      organization: {
        id: defaultOrg.organizationId,
        name: defaultOrg.organization.name,
        slug: defaultOrg.organization.slug,
        role: defaultOrg.role
      },
      memberships: memberships.map((m) => ({
        id: m.id,
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        organizationSlug: m.organization.slug,
        role: m.role
      }))
    });

    // Set session cookie
    response.cookies.set('circuitsoul_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Sign-in failed' },
      { status: 500 }
    );
  }
}
