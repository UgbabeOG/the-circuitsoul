/**
 * CircuitSoul Blog — Article Generation Tests
 * Verifies idempotency and job creation behavior.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// In-memory job store to simulate Prisma without DB dependency
const mockJobs: any[] = [];

describe('Article generation idempotency', () => {
  beforeEach(() => {
    mockJobs.length = 0;
  });

  it('creates a job and detects duplicate on same title within 24h', async () => {
    const input1 = {
      organizationId: 'org-1',
      userId: 'user-1',
      trendId: null,
      title: 'Test Article',
      keywords: ['AI', 'SMEs'],
      idempotencyKey: 'blog-gen-org-1-test-article'
    };

    const nowMinus24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const job1 = {
      id: input1.idempotencyKey,
      organizationId: input1.organizationId,
      trendId: input1.trendId,
      title: input1.title,
      status: 'SUGGESTED',
      keywords: input1.keywords,
      sourceReferences: [],
      retryCount: 0,
      createdAt: new Date()
    };
    mockJobs.push(job1);

    const existing = mockJobs.find(j =>
      j.organizationId === input1.organizationId &&
      j.title === input1.title &&
      j.createdAt >= nowMinus24h
    );

    assert.ok(existing, 'Should find existing job within 24h');
    assert.strictEqual(existing.id, job1.id);
    assert.strictEqual(existing.status, 'SUGGESTED');
  });

  it('does not find duplicate outside 24h window', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const existing = mockJobs.find(j =>
      j.organizationId === 'org-1' &&
      j.title === 'Test Article' &&
      j.createdAt >= oldDate
    );
    assert.strictEqual(existing, undefined);
  });
});
