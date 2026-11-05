import { NextResponse } from 'next/server';
import { prisma } from '@circuitsoul/db';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.VIEW_ORG
    );

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
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
