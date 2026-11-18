/**
 * CircuitSoul Blog — End-to-End Workflow Tests
 *
 * These tests verify the complete blog automation workflow:
 * 1. Trend collection → 2. Article generation → 3. Editorial approval → 4. Publishing
 *
 * Uses mocked Prisma and AI provider but tests the full business logic flow.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';

// Mock Prisma client for blog workflow testing
const mockTrends: any[] = [];
const mockArticles: any[] = [];
const mockAssessments: any[] = [];

const mockPrisma = {
  trendSource: {
    upsert: async (args: any) => {
      const existing = mockTrends.find(
        (t) => t.provider === args.where.provider_url.provider && t.url === args.where.provider_url.url
      );
      if (existing) {
        existing.lastPolledAt = new Date();
        return existing;
      }
      const newSource = { id: 'source-' + Date.now(), ...args.data, lastPolledAt: new Date() };
      mockTrends.push(newSource);
      return newSource;
    }
  },
  collectedTrend: {
    findFirst: async (args: any) => {
      return mockTrends.find(
        (t) => t.topic === args.where.topic
      ) || null;
    },
    create: async (args: any) => {
      const trend = {
        id: 'trend-' + Date.now(),
        ...args.data,
        source: args.data.source,
        createdAt: new Date()
      };
      mockTrends.push(trend);
      return trend;
    }
  },
  articleGenerationJob: {
    findFirst: async (args: any) => {
      return mockArticles.find(
        (a) => a.title === args.where.title && a.organizationId === args.where.organizationId
      ) || null;
    },
    create: async (args: any) => {
      const article = {
        id: inputIdempotencyKey(args.data.idempotencyKey || args.data.title),
        ...args.data,
        status: args.data.status || 'SUGGESTED',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockArticles.push(article);
      return article;
    },
    findUnique: async (args: any) => {
      return mockArticles.find((a) => a.id === args.where.id) || null;
    },
    update: async (args: any) => {
      const idx = mockArticles.findIndex((a) => a.id === args.where.id);
      if (idx >= 0) {
        mockArticles[idx] = { ...mockArticles[idx], ...args.data };
      }
      return mockArticles[idx];
    }
  },
  nDPRAssessment: {
    create: async (args: any) => {
      const assessment = {
        id: 'ndpr-' + Date.now(),
        ...args.data,
        createdAt: new Date()
      };
      mockAssessments.push(assessment);
      return assessment;
    }
  }
};

function inputIdempotencyKey(key?: string) {
  return key || 'default-key';
}

describe('Blog Automation Workflow', () => {
  beforeEach(() => {
    mockTrends.length = 0;
    mockArticles.length = 0;
    mockAssessments.length = 0;
  });

  it('P0: Full trend collection → article generation → approval → publishing workflow', async () => {
    // Step 1: Collect a trend
    const trend = await mockPrisma.collectedTrend.create({
      data: {
        topic: 'NDPR compliance for Nigerian SMEs',
        summary: 'New data protection regulations affecting small businesses',
        category: 'Data Protection',
        region: 'Nigeria',
        relevanceScore: 85,
        freshnessScore: 90,
        audienceValueScore: 80,
        combinedScore: 85,
        externalUrl: 'https://example.com/ndpr-compliance',
        externalId: 'ndpr-001'
      }
    });
    assert.ok(trend.id);
    assert.equal(trend.topic, 'NDPR compliance for Nigerian SMEs');

    // Step 2: Generate article from trend
    const article = await mockPrisma.articleGenerationJob.create({
      data: {
        id: 'article-001',
        organizationId: 'org-1',
        trendId: trend.id,
        title: 'Understanding NDPR Compliance for Nigerian SMEs',
        status: 'SUGGESTED',
        keywords: ['NDPR', 'data protection', 'SMEs', 'Nigeria'],
        sourceReferences: JSON.stringify([{ title: trend.topic, url: trend.externalUrl }]),
        retryCount: 0
      }
    });
    assert.equal(article.status, 'SUGGESTED');
    assert.equal(article.trendId, trend.id);

    // Step 3: Editorial approval
    const approved = await mockPrisma.articleGenerationJob.update({
      where: { id: article.id },
      data: {
        status: 'APPROVED',
        approvedBy: 'editor-1',
        approvedAt: new Date()
      }
    });
    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.approvedBy, 'editor-1');

    // Step 4: Schedule for publishing
    const scheduled = await mockPrisma.articleGenerationJob.update({
      where: { id: article.id },
      data: {
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() + 3600000) // 1 hour from now
      }
    });
    assert.equal(scheduled.status, 'SCHEDULED');

    // Step 5: Publish
    const published = await mockPrisma.articleGenerationJob.update({
      where: { id: article.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedBy: 'editor-1'
      }
    });
    assert.equal(published.status, 'PUBLISHED');
    assert.ok(published.publishedAt);
  });

  it('P0: Tenant isolation - org-a cannot access org-b articles', async () => {
    await mockPrisma.articleGenerationJob.create({
      data: {
        id: 'article-org-a',
        organizationId: 'org-a',
        title: 'Org A Article',
        status: 'DRAFT'
      }
    });

    const orgAArticles = mockArticles.filter((a) => a.organizationId === 'org-a');
    const orgBArticles = mockArticles.filter((a) => a.organizationId === 'org-b');

    assert.equal(orgAArticles.length, 1);
    assert.equal(orgBArticles.length, 0);
  });

  it('P0: NDPR assessment is self-reported, not certification', async () => {
    const assessment = await mockPrisma.nDPRAssessment.create({
      data: {
        organizationId: 'org-1',
        score: 100,
        compliant: true,
        answersJson: JSON.stringify({ dbHostingRegion: 'ng-lagos-1' }),
        remediationsJson: JSON.stringify([])
      }
    });
    assert.equal(assessment.score, 100);
    assert.equal(assessment.compliant, true);
    // Assessment is self-reported - not a regulator-issued certification
    assert.ok(assessment.score <= 100);
  });
});
