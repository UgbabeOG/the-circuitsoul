import { NextResponse } from 'next/server';
import { blogAdapter } from '@circuitsoul/api-adapters';
import { prisma, Role, assertOrganizationMembership } from '@circuitsoul/db';
import { Permission, requirePermission, requireSession } from '@circuitsoul/auth';

export async function POST(request: Request) {
  try {
    const session = requirePermission(requireSession(Object.fromEntries(request.headers.entries())), Permission.PUBLISH_CONTENT);
    await assertOrganizationMembership(session.userId, session.orgId, [Role.ADMIN, Role.OWNER]);
    const body = await request.json();
    const { title, content, excerpt, status = 'published', tags, feature_image } = body;

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'Title and content are required to publish' },
        { status: 400 }
      );
    }

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

    const ghostPost = await blogAdapter.createPost({
      title,
      html: formattedHtml,
      excerpt,
      status: status as 'draft' | 'published',
      tags: tags || ['African SaaS', 'Digital Infrastructure'],
      feature_image
    });

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

    await prisma.blogPost.updateMany({
      where: {
        title,
        authorId: session.userId,
        organizationId: session.orgId
      },
      data: {
        status: status === 'published' ? 'PUBLISHED' : 'DRAFT',
        content
      }
    });

    return NextResponse.json({
      success: true,
      post: ghostPost
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Publishing to Ghost failed' },
      { status: 500 }
    );
  }
}
