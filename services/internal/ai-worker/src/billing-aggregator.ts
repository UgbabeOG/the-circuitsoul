/**
 * Billing Aggregator — Periodic Usage Event Aggregation
 *
 * Runs as a BullMQ repeatable (scheduled) job that:
 * 1. Fetches un-aggregated UsageEvent rows in batches
 * 2. Groups them by (subscriptionId, eventType)
 * 3. Upserts UsageRecord entries with summed quantities
 * 4. Marks processed UsageEvent rows as aggregated
 * 5. Emits a usage-aggregation.v1 event on completion
 *
 * Stateless — safe to run on any worker instance.
 */

import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { eventBus } from '@circuitsoul/events';
import { Events } from '@circuitsoul/events/src/registry';
import {
  fetchUnaggregatedEvents,
  markEventsAggregated,
  upsertUsageRecord
} from './persistence-layer';
import type { AggregationResult } from './types';

const AGGREGATION_QUEUE_NAME = 'usage-aggregation';
const DEFAULT_INTERVAL_MS = 60_000; // 60 seconds
const DEFAULT_BATCH_SIZE = 500;

// ─── Core Aggregation Logic ───────────────────────────────────────────────────

/**
 * Aggregate un-aggregated usage events into UsageRecord entries.
 * This is the core function called by the scheduled job.
 */
export async function aggregateUsageEvents(
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<AggregationResult> {
  const result: AggregationResult = {
    processedCount: 0,
    recordsUpserted: 0,
    errors: []
  };

  const events = await fetchUnaggregatedEvents(batchSize);

  if (events.length === 0) {
    return result;
  }

  // Group events by (subscriptionId, eventType)
  const groups = new Map<string, {
    subscriptionId: string;
    eventType: string;
    totalTokens: number;
    totalStorageBytes: number;
    totalGenerationMs: number;
    totalJobs: number;
    eventIds: string[];
  }>();

  for (const event of events) {
    if (!event.subscriptionId) {
      // Events without a subscriptionId can't be billed — skip but mark aggregated
      result.errors.push(
        `UsageEvent ${event.id} has no subscriptionId, skipping billing`
      );
      continue;
    }

    const key = `${event.subscriptionId}:${event.eventType}`;
    const group = groups.get(key) ?? {
      subscriptionId: event.subscriptionId,
      eventType: event.eventType,
      totalTokens: 0,
      totalStorageBytes: 0,
      totalGenerationMs: 0,
      totalJobs: 0,
      eventIds: []
    };

    group.totalTokens += event.tokensUsed;
    group.totalStorageBytes += event.storageBytes;
    group.totalGenerationMs += event.generationMs;
    group.totalJobs += event.jobsExecuted;
    group.eventIds.push(event.id);

    groups.set(key, group);
  }

  // Upsert UsageRecords for each group
  for (const [, group] of groups) {
    try {
      // Create usage records for each metric dimension
      await upsertUsageRecord(
        group.subscriptionId,
        `tokens:${group.eventType}`,
        group.totalTokens,
        `Aggregated from ${group.eventIds.length} events`
      );

      await upsertUsageRecord(
        group.subscriptionId,
        `jobs:${group.eventType}`,
        group.totalJobs
      );

      if (group.totalStorageBytes > 0) {
        await upsertUsageRecord(
          group.subscriptionId,
          `storage_bytes:${group.eventType}`,
          group.totalStorageBytes
        );
      }

      // Mark events as aggregated
      await markEventsAggregated(group.eventIds);

      result.recordsUpserted += 1;
      result.processedCount += group.eventIds.length;
    } catch (error: any) {
      result.errors.push(
        `Failed to aggregate group ${group.subscriptionId}:${group.eventType}: ${error?.message}`
      );
    }
  }

  // Also mark orphaned events (no subscriptionId) as aggregated
  const orphanIds = events
    .filter(e => !e.subscriptionId)
    .map(e => e.id);

  if (orphanIds.length > 0) {
    await markEventsAggregated(orphanIds);
    result.processedCount += orphanIds.length;
  }

  return result;
}

// ─── Scheduled Job Setup ──────────────────────────────────────────────────────

/**
 * Start the billing aggregator as a BullMQ repeatable job.
 * This can run on any worker instance — BullMQ ensures only one
 * instance processes each scheduled tick.
 */
export function startBillingAggregatorSchedule(
  connection: ConnectionOptions,
  intervalMs: number = DEFAULT_INTERVAL_MS
): { queue: Queue; worker: Worker } {
  const queue = new Queue(AGGREGATION_QUEUE_NAME, { connection });

  // Add repeatable job — BullMQ deduplicates by repeat key
  queue.add(
    'aggregate-usage',
    {},
    {
      repeat: { every: intervalMs },
      removeOnComplete: true,
      removeOnFail: 50 // Keep last 50 failures for debugging
    }
  );

  const worker = new Worker(
    AGGREGATION_QUEUE_NAME,
    async () => {
      console.log('[billing-aggregator] Running usage aggregation...');
      const result = await aggregateUsageEvents();

      console.log(
        `[billing-aggregator] Aggregation complete: ${result.processedCount} events → ${result.recordsUpserted} records` +
        (result.errors.length > 0 ? ` (${result.errors.length} errors)` : '')
      );

      // Emit aggregation completion event
      eventBus.emit(Events.UsageAggregationV1, {
        processedCount: result.processedCount,
        recordsUpserted: result.recordsUpserted,
        errors: result.errors,
        timestamp: Date.now()
      });
    },
    {
      connection,
      concurrency: 1 // Aggregation must run serially
    }
  );

  worker.on('failed', (job, err) => {
    console.error(
      `[billing-aggregator] Aggregation job failed: ${job?.id}`,
      err?.message ?? err
    );
  });

  return { queue, worker };
}
