/**
 * Usage Emitter — Telemetry Event Emission
 *
 * Emits usage events to:
 * 1. The in-process EventBus (for local real-time subscribers)
 * 2. The UsageEvent database table (for billing aggregation)
 *
 * Stateless — safe for concurrent use across worker instances.
 */

import { eventBus } from '@circuitsoul/events';
import { Events } from '@circuitsoul/events/src/registry';
import { createUsageEvent } from './persistence-layer';
import type { UsageEventData } from './types';

/**
 * Emit a usage event through both channels:
 * - In-process EventBus for real-time subscribers
 * - Database persistence for the billing aggregator pipeline
 *
 * Failures in event emission are logged but do NOT fail the parent job.
 * Usage tracking is important but must not block AI generation delivery.
 */
export async function emitUsageEvent(
  data: UsageEventData
): Promise<void> {
  try {
    // 1. Persist to database for billing aggregation
    await createUsageEvent(data);

    // 2. Emit to in-process EventBus for real-time subscribers
    eventBus.emit(Events.UsageEventV1, data);
  } catch (error: any) {
    // Usage emission failure must not crash the worker.
    // Log and continue — the billing aggregator can reconcile later.
    console.error(
      `[usage-emitter] Failed to emit usage event for org=${data.organizationId}, job=${data.jobId}:`,
      error?.message ?? error
    );
  }
}
