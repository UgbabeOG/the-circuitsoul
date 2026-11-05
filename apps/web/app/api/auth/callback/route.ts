import { NextResponse } from 'next/server';
import { parseProviderToken, signSessionToken } from '@circuitsoul/auth';
import { prisma, Role } from '@circuitsoul/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token && !email) {
      return NextResponse.json(
        { success: false, error: 'No token or email provided' },
        { status: 400 }
      );
    }

    let session: { userId: string; email: string; name?: string; orgId: string; role: string } | null = null;

    if (token) {
      // Verify the provider token (Clerk JWT or custom session)
      const verified = parseProviderToken(token);
      if (!verified) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired token' },
          { status: 401 }
        );
      }
      session = {
        userId: verified.userId,
        email: verified.email,
        name: verified.name,
        orgId: verified.orgId,
        role: verified.role
      };
    } else if (email) {
      // Custom provider email-based sign-in
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: { email, name: email.split('@')[0] }
        });
      }

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

      const defaultOrg = memberships[0];
      session = {
        userId: user.id,
        email: user.email,
        name: user.name || undefined,
        orgId: defaultOrg.organizationId,
        role: defaultOrg.role
      };
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 500 }
      );
    }

    const tokenString = signSessionToken({
      userId: session.userId,
      email: session.email,
      name: session.name,
      orgId: session.orgId,
      role: session.role as Role
    });

    const response = NextResponse.json({
      success: true,
      token: tokenString,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name
      },
      organization: {
        id: session.orgId,
      role: session.role as Role
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Callback failed' },
      { status: 500 }
    );
  }
}
