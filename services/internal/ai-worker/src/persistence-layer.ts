/**
 * Persistence Layer — All Database Operations
 *
 * This module is responsible ONLY for database reads and writes.
 * It has ZERO dependencies on @circuitsoul/ai.
 * Every function is stateless and takes explicit parameters.
 */

import { prisma, AiGenerationType } from '@circuitsoul/db';
import type { AiGeneration, JobLog, UsageEvent } from '@circuitsoul/db';
import type { UsageEventData } from './types';

// ─── Idempotency ──────────────────────────────────────────────────────────────

/**
 * Check if a generation with the given idempotency key already exists.
 * Returns the existing record or null.
 */
export async function checkIdempotency(
  idempotencyKey: string,
  organizationId: string
): Promise<AiGeneration | null> {
  return prisma.aiGeneration.findFirst({
    where: { idempotencyKey, organizationId }
  });
}

// ─── AI Generation Persistence ────────────────────────────────────────────────

export interface SaveGenerationInput {
  organizationId: string;
  userId?: string;
  prompt: string;
  response: string;
  tokenCount: number;
  type: AiGenerationType;
  idempotencyKey: string;
}

/**
 * Persist a completed AI generation to the database.
 */
export async function saveGeneration(
  input: SaveGenerationInput
): Promise<AiGeneration> {
  return prisma.aiGeneration.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? '',
      prompt: input.prompt,
      response: input.response,
      tokenCount: input.tokenCount,
      type: input.type,
      idempotencyKey: input.idempotencyKey
    }
  });
}

// ─── Job Logging ──────────────────────────────────────────────────────────────

export interface CreateJobLogInput {
  jobId: string;
  queueName: string;
  jobName: string;
  attempt: number;
  status: 'ATTEMPT' | 'SUCCEEDED' | 'FAILED' | 'DLQ';
  error?: string;
  payload?: unknown;
}

/**
 * Create a job execution log entry.
 */
export async function createJobLog(input: CreateJobLogInput): Promise<JobLog> {
  return prisma.jobLog.create({
    data: {
      jobId: input.jobId,
      queueName: input.queueName,
      jobName: input.jobName,
      attempt: input.attempt,
      status: input.status,
      error: input.error,
      payload: input.payload as any
    }
  });
}

// ─── Usage Event Persistence ──────────────────────────────────────────────────

/**
 * Create a raw usage telemetry event in the database.
 * These events are later aggregated by the billing-aggregator.
 */
export async function createUsageEvent(
  data: UsageEventData
): Promise<UsageEvent> {
  return prisma.usageEvent.create({
    data: {
      organizationId: data.organizationId,
      subscriptionId: data.subscriptionId,
      userId: data.userId,
      jobId: data.jobId,
      eventType: data.eventType,
      tokensUsed: data.tokensUsed,
      storageBytes: data.storageBytes,
      generationMs: data.generationMs,
      jobsExecuted: data.jobsExecuted,
      rawPayload: data.rawPayload as any
    }
  });
}

// ─── Usage Aggregation Queries ────────────────────────────────────────────────

/**
 * Fetch un-aggregated usage events in batches for the billing aggregator.
 */
export async function fetchUnaggregatedEvents(
  batchSize: number = 500
): Promise<UsageEvent[]> {
  return prisma.usageEvent.findMany({
    where: { aggregated: false },
    orderBy: { createdAt: 'asc' },
    take: batchSize
  });
}

/**
 * Mark a batch of usage events as aggregated within a transaction.
 */
export async function markEventsAggregated(
  eventIds: string[]
): Promise<void> {
  await prisma.usageEvent.updateMany({
    where: { id: { in: eventIds } },
    data: { aggregated: true }
  });
}

/**
 * Upsert a UsageRecord for the current billing period.
 * If a record exists for the subscription + metric combination,
 * increment the quantity. Otherwise, create a new record.
 */
export async function upsertUsageRecord(
  subscriptionId: string,
  metric: string,
  quantity: number,
  notes?: string
): Promise<void> {
  // Try to find an existing record for this period
  const existing = await prisma.usageRecord.findFirst({
    where: {
      subscriptionId,
      metric
    },
    orderBy: { recordedAt: 'desc' }
  });

  if (existing) {
    await prisma.usageRecord.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + quantity,
        notes: notes ?? existing.notes
      }
    });
  } else {
    await prisma.usageRecord.create({
      data: {
        subscriptionId,
        metric,
        quantity,
        notes
      }
    });
  }
}
