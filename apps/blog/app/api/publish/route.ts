import { NextResponse } from 'next/server';
import { blogAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';
import { parseSession } from '@circuitsoul/auth';

export async function POST(request: Request) {
  try {
    const session = parseSession(Object.fromEntries(request.headers.entries()));
    const body = await request.json();
    const { title, content, excerpt, status = 'published', tags, feature_image } = body;

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'Title and content are required to publish' },
        { status: 400 }
      );
    }

    // Convert Markdown/text to HTML for Ghost Admin API
    const formattedHtml = content.startsWith('<')
      ? content
      : `<div class="circuitsoul-article">${content
          .split('\n\n')
          .map((p: string) => {
            if (p.startsWith('# ')) return `<h1>${p.replace('# ', '')}</h1>`;
            if (p.startsWith('## ')) return `<h2>${p.replace('## ', '')}</h2>`;
            if (p.startsWith('### ')) return `<h3>${p.replace('### ', '')}</h3>`;
            return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
          })
          .join('')}</div>`;

    // Publish or stage through Ghost API Adapter
    const ghostPost = await blogAdapter.createPost({
      title,
      html: formattedHtml,
      excerpt,
      status: status as 'draft' | 'published',
      tags: tags || ['African SaaS', 'Digital Infrastructure'],
      feature_image
    });

    // Record billing usage
    try {
      if (session?.orgId) {
        await prisma.usageEvent.create({
          data: {
            organizationId: session.orgId,
            userId: session.userId,
            eventType: 'BLOG_PUBLICATION',
            jobsExecuted: 1,
            generationMs: 650,
            rawPayload: {
              ghostId: ghostPost.id,
              status: ghostPost.status,
              slug: ghostPost.slug
            }
          }
        });
      }
    } catch {
      // Dev/mock mode fallback
    }

    // Update status in Prisma DB
    try {
      if (session?.userId) {
        await prisma.blogPost.updateMany({
          where: { title, authorId: session.userId },
          data: {
            status: status === 'published' ? 'PUBLISHED' : 'DRAFT',
            content
          }
        });
      }
    } catch {
      // Dev/mock mode fallback
    }

    return NextResponse.json({
      success: true,
      post: ghostPost
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Publishing to Ghost failed' },
      { status: 500 }
    );
  }
}
