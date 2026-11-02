import { NextResponse } from 'next/server';
import { blogAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';
import { parseSession } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    const session = parseSession(Object.fromEntries(request.headers.entries()));
    const posts = await blogAdapter.getPosts();

    let dbPosts: any[] = [];
    try {
      if (session?.userId) {
        dbPosts = await prisma.blogPost.findMany({
          where: { authorId: session.userId },
          orderBy: { updatedAt: 'desc' }
        });
      }
    } catch {
      // Dev/mock mode fallback
    }

    return NextResponse.json({
      success: true,
      posts,
      dbPosts,
      count: posts.length
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
