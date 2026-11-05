import { NextResponse } from 'next/server';
import { aiService } from '@circuitsoul/ai';
import { prisma, Role, assertOrganizationMembership, enforceEntitlement, recordUsage } from '@circuitsoul/db';
import { Permission, requirePermission, requireSession } from '@circuitsoul/auth';

export async function POST(request: Request) {
  try {
    const session = requirePermission(requireSession(Object.fromEntries(request.headers.entries())), Permission.VIEW_ORG);
    await assertOrganizationMembership(session.userId, session.orgId, [Role.MEMBER]);

    // Enforce entitlement before expensive AI operation
    await enforceEntitlement(session.orgId, 'AI_GENERATION');

    const body = await request.json();
    const { topic, keywords } = body;

    if (!topic || !topic.trim()) {
      return NextResponse.json(
        { success: false, error: 'Article topic is required' },
        { status: 400 }
      );
    }

    const keywordList = Array.isArray(keywords)
      ? keywords
      : typeof keywords === 'string'
        ? keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
        : ['NDPR', 'African SaaS', 'Cloud Security'];

    const content = await aiService.generateBlogDraft(topic, keywordList);

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    const slug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    await recordUsage({
      organizationId: session.orgId,
      subscriptionId: undefined,
      userId: session.userId,
      eventType: 'AI_GENERATION',
      tokensUsed: wordCount * 2,
      generationMs: 1450,
      rawPayload: {
        type: 'BLOG_CONTENT',
        topic,
        wordCount
      }
    });

    const dbRecord = await prisma.blogPost.create({
      data: {
        organizationId: session.orgId,
        authorId: session.userId,
        title: topic,
        slug,
        content,
        summary: content.substring(0, 160) + '...',
        status: 'DRAFT',
        seoKeywords: keywordList
      }
    });

    return NextResponse.json({
      success: true,
      draft: {
        title: topic,
        slug,
        content,
        keywords: keywordList,
        wordCount,
        readingTime,
        dbId: dbRecord.id
      }
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message.startsWith('EntitlementDenied')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'AI Generation failed' },
      { status: 500 }
    );
  }
}
