import { NextResponse } from 'next/server';
import { z } from 'zod';
import { blogAdapter } from '@circuitsoul/api-adapters';
import { enforceEntitlement, prisma, recordUsage } from '@circuitsoul/db';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';
import { sanitizeBlogHtml } from '../../../lib/sanitize-content';

const PublishSchema = z.object({
  title: z.string().trim().min(5).max(200),
  content: z.string().min(1).max(200_000),
  excerpt: z.string().max(500).optional(),
  status: z.enum(['draft', 'published']).default('published'),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  feature_image: z.string().url().startsWith('https://').optional()
}).strict();

function toSafeHtml(content: string): string {
  const html = content.startsWith('<')
    ? content
    : `<div class="circuitsoul-article">${content
      .split('\n\n')
      .map((paragraph) => {
        const escaped = paragraph.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (paragraph.startsWith('### ')) return `<h3>${escaped.slice(4)}</h3>`;
        if (paragraph.startsWith('## ')) return `<h2>${escaped.slice(3)}</h2>`;
        if (paragraph.startsWith('# ')) return `<h1>${escaped.slice(2)}</h1>`;
        return `<p>${escaped.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('')}</div>`;
  return sanitizeBlogHtml(html);
}

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.PUBLISH_CONTENT
    );
    await enforceEntitlement(session.orgId, 'BLOG_PUBLICATION');

    const parsed = PublishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid publishing request' },
        { status: 400 }
      );
    }
    const { title, content, excerpt, status, tags, feature_image } = parsed.data;
    const html = toSafeHtml(content);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Title must contain letters or numbers' }, { status: 400 });
    }

    const existingPost = await prisma.blogPost.findUnique({ where: { slug } });
    if (existingPost && (
      existingPost.organizationId !== session.orgId ||
      existingPost.authorId !== session.userId
    )) {
      return NextResponse.json({ success: false, error: 'Slug is owned by another publisher' }, { status: 409 });
    }

    const startedAt = Date.now();
    const ghostPost = await blogAdapter.createPost({
      title,
      html,
      excerpt,
      status,
      tags: tags || ['African SaaS', 'Digital Infrastructure'],
      feature_image
    });

    const postData = {
      title,
      content: html,
      summary: excerpt || `${content.substring(0, 157)}...`,
      status: status === 'published' ? 'PUBLISHED' as const : 'DRAFT' as const,
      seoKeywords: tags || ['African SaaS', 'Digital Infrastructure'],
      externalGhostId: ghostPost.id
    };
    if (existingPost) {
      await prisma.blogPost.update({ where: { id: existingPost.id }, data: postData });
    } else {
      await prisma.blogPost.create({
        data: {
          ...postData,
          organizationId: session.orgId,
          authorId: session.userId,
          slug
        }
      });
    }

    await recordUsage({
      organizationId: session.orgId,
      userId: session.userId,
      eventType: 'BLOG_PUBLICATION',
      jobsExecuted: 1,
      generationMs: Date.now() - startedAt,
      rawPayload: { ghostId: ghostPost.id, status: ghostPost.status, slug }
    });

    return NextResponse.json({
      success: true,
      post: { ...ghostPost, html, externalGhostId: ghostPost.id, organizationId: session.orgId }
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.startsWith('EntitlementDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Publishing to Ghost failed' },
      { status: 500 }
    );
  }
}
