import { NextResponse } from 'next/server';
import { blogAdapter } from '@circuitsoul/api-adapters';
import { prisma, enforceEntitlement, recordUsage } from '@circuitsoul/db';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.PUBLISH_CONTENT
    );

    // Enforce entitlement before publishing
    await enforceEntitlement(session.orgId, 'BLOG_PUBLICATION');

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

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const ghostPost = await blogAdapter.createPost({
      title,
      html: formattedHtml,
      excerpt,
      status: status as 'draft' | 'published',
      tags: tags || ['African SaaS', 'Digital Infrastructure'],
      feature_image
    });

    // Persist org-owned Ghost record mapping: link the external Ghost post ID to this org's BlogPost
    const existingPost = await prisma.blogPost.findFirst({
      where: {
        slug,
        organizationId: session.orgId,
        authorId: session.userId
      }
    });

    if (existingPost) {
      await prisma.blogPost.update({
        where: { id: existingPost.id },
        data: {
          status: status === 'published' ? 'PUBLISHED' : 'DRAFT',
          content: formattedHtml,
          summary: excerpt || content.substring(0, 160) + '...',
          externalGhostId: ghostPost.id,
          seoKeywords: tags || ['African SaaS', 'Digital Infrastructure']
        }
      });
    } else {
      await prisma.blogPost.create({
        data: {
          organizationId: session.orgId,
          authorId: session.userId,
          title,
          slug,
          content: formattedHtml,
          summary: excerpt || content.substring(0, 160) + '...',
          status: status === 'published' ? 'PUBLISHED' : 'DRAFT',
          seoKeywords: tags || ['African SaaS', 'Digital Infrastructure'],
          externalGhostId: ghostPost.id
        }
      });
    }

    await recordUsage({
      organizationId: session.orgId,
      userId: session.userId,
      eventType: 'BLOG_PUBLICATION',
      jobsExecuted: 1,
      generationMs: 650,
      rawPayload: {
        ghostId: ghostPost.id,
        status: ghostPost.status,
        slug: ghostPost.slug,
        externalGhostId: ghostPost.id
      }
    });

    return NextResponse.json({
      success: true,
      post: {
        ...ghostPost,
        externalGhostId: ghostPost.id,
        organizationId: session.orgId
      }
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
    if (error instanceof Error && error.message.startsWith('EntitlementDenied')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Publishing to Ghost failed' },
      { status: 500 }
    );
  }
}
