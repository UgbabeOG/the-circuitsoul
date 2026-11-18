/**
 * CircuitSoul Blog — Scheduled Publishing
 *
 * Publishes approved, scheduled articles to Ghost CMS. All publishing
 * is approval-first: only articles with status APPROVED and a scheduledAt
 * time in the past are published. Publishing attempts are recorded for
 * audit and retry purposes.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@circuitsoul/db';
import { blogAdapter } from '@circuitsoul/api-adapters';
import { createQueue, defaultJobOptions, defaultRedisConnection } from './index';
import { JobsOptions } from 'bullmq';

export const SCHEDULED_PUBLISHING_QUEUE_NAME = 'scheduled-publishing';

export interface ScheduledPublishingJobData {
  articleId: string;
  organizationId: string;
  force?: boolean;
}

export function createScheduledPublishingQueue(connection = defaultRedisConnection()) {
  return createQueue(SCHEDULED_PUBLISHING_QUEUE_NAME, connection);
}

export async function enqueueScheduledPublishing(
  data: ScheduledPublishingJobData,
  connection = defaultRedisConnection(),
  opts: Partial<JobsOptions> = {}
) {
  const queue = createScheduledPublishingQueue(connection);
  await queue.add('scheduled-publishing', data, { ...defaultJobOptions, ...opts });
}

export async function publishScheduledArticles(
  connection = defaultRedisConnection()
) {
  const now = new Date();

  // Find approved articles scheduled for publishing
  const dueArticles = await prisma.articleGenerationJob.findMany({
    where: {
      status: 'APPROVED',
      scheduledAt: { lte: now }
    },
    orderBy: { scheduledAt: 'asc' },
    take: 10
  });

  const results = [];

  for (const article of dueArticles) {
    const attemptNumber = await prisma.publishingAttempt.count({
      where: { articleId: article.id }
    });

    try {
      const ghostPost = await blogAdapter.createPost({
        title: article.title,
        html: article.content || '',
        excerpt: article.summary == null ? undefined : article.summary,
        status: 'published',
        tags: article.keywords || ['African SaaS', 'Digital Infrastructure'],
        feature_image: article.heroImageUrl == null ? undefined : article.heroImageUrl
      });

      await prisma.publishingAttempt.create({
        data: {
          articleId: article.id,
          organizationId: article.organizationId,
          ghostPostId: ghostPost.id,
          status: 'published',
          attemptNumber: attemptNumber + 1,
          responsePayload: ghostPost as unknown as any
        }
      });

      await prisma.articleGenerationJob.update({
        where: { id: article.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: now
        }
      });

      results.push({
        articleId: article.id,
        title: article.title,
        status: 'PUBLISHED',
        ghostPostId: ghostPost.id
      });
    } catch (err: any) {
      await prisma.publishingAttempt.create({
        data: {
          articleId: article.id,
          organizationId: article.organizationId,
          status: 'failed',
          attemptNumber: attemptNumber + 1,
          errorMessage: err instanceof Error ? err.message : 'Publishing failed'
        }
      });

      await prisma.articleGenerationJob.update({
        where: { id: article.id },
        data: {
          status: 'FAILED',
          lastError: err instanceof Error ? err.message : 'Publishing failed',
          retryCount: { increment: 1 }
        }
      });

      results.push({
        articleId: article.id,
        title: article.title,
        status: 'FAILED',
        error: err instanceof Error ? err.message : 'Publishing failed'
      });
    }
  }

  return results;
}
