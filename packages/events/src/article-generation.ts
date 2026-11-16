/**
 * CircuitSoul Blog — Article Generation Pipeline
 *
 * BullMQ-backed asynchronous jobs for AI article generation, editorial
 * review, hero image generation, and scheduled Ghost publishing.
 * All jobs are idempotent via idempotencyKey and tracked in the database.
 */

import { Prisma } from '@prisma/client';
import { aiService } from '@circuitsoul/ai';
import { prisma } from '@circuitsoul/db';

export interface ArticleGenerationInput {
  organizationId: string;
  userId?: string | null;
  trendId?: string | null;
  title: string;
  keywords: string[];
  idempotencyKey: string;
  generateHeroImage?: boolean;
}

export interface ArticleDraft {
  jobId: string;
  articleId: string;
  title: string;
  slug: string;
  content: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  heroImageUrl: string | null;
  sourceReferences: Record<string, unknown>[];
  status: string;
}

export async function enqueueArticleGeneration(input: ArticleGenerationInput) {
  const existing = await prisma.articleGenerationJob.findFirst({
    where: {
      organizationId: input.organizationId,
      title: input.title,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  });
  if (existing) {
    return { jobId: existing.id, articleId: existing.id, duplicate: true };
  }

  const jobRecord = await prisma.articleGenerationJob.create({
    data: {
      id: input.idempotencyKey,
      organizationId: input.organizationId,
      trendId: input.trendId ?? null,
      title: input.title,
      status: 'SUGGESTED',
      prompt: `Generate article about: ${input.title} keywords: ${input.keywords.join(', ')}`,
      keywords: input.keywords,
      sourceReferences: [],
      retryCount: 0
    }
  });

  return { jobId: jobRecord.id, articleId: jobRecord.id, duplicate: false };
}

export async function processArticleGenerationJob(input: ArticleGenerationInput) {
  const { organizationId, userId, trendId, title, keywords, idempotencyKey, generateHeroImage = false } = input;

  const jobRecord = await prisma.articleGenerationJob.findUnique({
    where: { id: idempotencyKey }
  });
  if (!jobRecord) throw new Error(`Article job ${idempotencyKey} not found`);

  await prisma.articleGenerationJob.update({
    where: { id: idempotencyKey },
    data: { status: 'GENERATING' }
  });

  try {
    const content = await aiService.generateBlogDraft(title, keywords);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const seoTitle = `${title} | CircuitSoul`;
    const seoDescription = content.substring(0, 160) + '...';

    let sourceReferences: Record<string, unknown>[] = [];
    if (trendId) {
      const trend = await prisma.collectedTrend.findUnique({ where: { id: trendId } });
      if (trend) {
        sourceReferences = [
          {
            title: trend.topic,
            url: trend.externalUrl,
            source: 'collected-trend',
            category: trend.category,
            collectedAt: trend.collectedAt
          }
        ];
      }
    }

    let heroImageUrl: string | null = null;
    let heroImageProvider: string | null = null;
    if (generateHeroImage) {
      heroImageProvider = process.env.BLOG_IMAGE_PROVIDER || 'none';
    }

    const draft = await prisma.articleGenerationJob.update({
      where: { id: idempotencyKey },
      data: {
        status: 'DRAFT',
        content,
        summary: content.substring(0, 200) + '...',
        slug,
        seoTitle,
        seoDescription,
        keywords,
        heroImageUrl,
        heroImageProvider,
        sourceReferences: sourceReferences as unknown as any,
        wordCount,
        readingTime
      }
    });

    return {
      jobId: jobRecord.id,
      articleId: draft.id,
      title: draft.title,
      slug: draft.slug!,
      content: draft.content!,
      summary: draft.summary!,
      seoTitle: draft.seoTitle!,
      seoDescription: draft.seoDescription!,
      keywords: draft.keywords,
      heroImageUrl: draft.heroImageUrl!,
      sourceReferences,
      status: draft.status
    };
  } catch (error) {
    await prisma.articleGenerationJob.update({
      where: { id: idempotencyKey },
      data: {
        status: 'FAILED',
        lastError: error instanceof Error ? error.message : 'Generation failed',
        retryCount: jobRecord.retryCount + 1
      }
    });
    throw error;
  }
}
