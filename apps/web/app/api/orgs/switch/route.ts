import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg, signSessionToken, switchOrganization } from '@circuitsoul/auth';
import { z } from 'zod';

const SwitchOrgSchema = z.object({
  organizationId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    const body = await request.json();
    const parsed = SwitchOrgSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const { organizationId } = parsed.data;

    // Validate membership in the target org (DB-backed, never trusts client)
    const role = await switchOrganization(session.userId, organizationId);

    // Issue a new session token with the switched org context
    const token = signSessionToken({
      userId: session.userId,
      email: session.email,
      name: session.name,
      orgId: organizationId,
      role
    });

    const response = NextResponse.json({
      success: true,
      token,
      organizationId,
      role,
      userId: session.userId
    });

    response.cookies.set('circuitsoul_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Organization switch failed' },
      { status: 500 }
    );
  }
}
