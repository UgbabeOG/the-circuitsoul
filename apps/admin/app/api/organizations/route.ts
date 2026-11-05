import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { prisma, Role } from '@circuitsoul/db';

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    // Only owners and admins can view all organizations
    if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Requires OWNER or ADMIN role' },
        { status: 403 }
      );
    }

    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
            _count: {
              select: {
                memberships: true,
                assets: true,
                environments: true,
                workflows: true,
                aiGenerations: true
              }
            }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      members: org._count.memberships,
      assets: org._count.assets,
      environments: org._count.environments,
      workflows: org._count.workflows,
      aiGenerations: org._count.aiGenerations,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt
    }));

    return NextResponse.json({
      success: true,
      organizations: formatted,
      count: formatted.length
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
