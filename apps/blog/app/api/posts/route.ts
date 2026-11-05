import { NextResponse } from 'next/server';
import { prisma, Role, assertOrganizationMembership } from '@circuitsoul/db';
import { Permission, requirePermission, requireSession } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    const session = requirePermission(requireSession(Object.fromEntries(request.headers.entries())), Permission.VIEW_ORG);
    await assertOrganizationMembership(session.userId, session.orgId, [Role.MEMBER]);

    const dbPosts = await prisma.blogPost.findMany({
      where: {
        organizationId: session.orgId
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      posts: dbPosts,
      count: dbPosts.length,
      organizationId: session.orgId
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
