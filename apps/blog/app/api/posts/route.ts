import { NextResponse } from 'next/server';
import { blogAdapter } from '@circuitsoul/api-adapters';
import { prisma, Role, assertOrganizationMembership } from '@circuitsoul/db';
import { Permission, requirePermission, requireSession } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    const session = requirePermission(requireSession(Object.fromEntries(request.headers.entries())), Permission.VIEW_ORG);
    await assertOrganizationMembership(session.userId, session.orgId, [Role.MEMBER]);
    const posts = await blogAdapter.getPosts();

    const dbPosts = await prisma.blogPost.findMany({
      where: {
        authorId: session.userId,
        organizationId: session.orgId
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      posts,
      dbPosts,
      count: posts.length
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
