import { NextResponse } from 'next/server';
import { prisma } from '@circuitsoul/db';
import { requirePlatformAdmin } from '../../../lib/platform-admin';

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin(Object.fromEntries(request.headers.entries()));

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
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
