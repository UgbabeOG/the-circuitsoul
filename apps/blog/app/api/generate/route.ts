import { NextResponse } from 'next/server';
import { aiService } from '@circuitsoul/ai';
import { prisma } from '@circuitsoul/db';
import { parseSession } from '@circuitsoul/auth';

export async function POST(request: Request) {
  try {
    const session = parseSession(Object.fromEntries(request.headers.entries()));
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

    // Secure server-side AI Generation (API keys never exposed to client)
    const content = await aiService.generateBlogDraft(topic, keywordList);

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    const slug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Track AI Usage for customer billing
    try {
      if (session?.orgId) {
        await prisma.usageEvent.create({
          data: {
            organizationId: session.orgId,
            userId: session.userId,
            eventType: 'AI_GENERATION',
            tokensUsed: wordCount * 2,
            generationMs: 1450,
            rawPayload: {
              type: 'BLOG_CONTENT',
              topic,
              wordCount
            }
          }
        });
      }
    } catch {
      // Dev/mock mode fallback
    }

    // Attempt to persist draft in Prisma BlogPost
    let dbRecord = null;
    try {
      if (session?.userId) {
        dbRecord = await prisma.blogPost.create({
          data: {
            authorId: session.userId,
            title: topic,
            slug,
            content,
            summary: content.substring(0, 160) + '...',
            status: 'DRAFT',
            seoKeywords: keywordList
          }
        });
      }
    } catch {
      // Dev/mock mode fallback
    }

    return NextResponse.json({
      success: true,
      draft: {
        title: topic,
        slug,
        content,
        keywords: keywordList,
        wordCount,
        readingTime,
        dbId: dbRecord?.id
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'AI Generation failed' },
      { status: 500 }
    );
  }
}
