/**
 * AI Worker — Entry Point (Thin Bootstrap)
 *
 * This is a stateless, horizontally scalable worker.
 * All processing logic is delegated to the job-processor module.
 * No shared mutable state — each job gets its own immutable context.
 *
 * Environment Variables:
 *   REDIS_URL          - Redis connection URL (default: redis://127.0.0.1:6379)
 *   WORKER_CONCURRENCY - Number of concurrent jobs (default: 5)
 *   AGGREGATOR_INTERVAL_MS - Billing aggregation interval (default: 60000)
 */

import 'dotenv/config';
import type { ConnectionOptions } from 'bullmq';
import { createAIGenerationWorker, createDeadLetterQueue } from '@circuitsoul/events';
import { prisma } from '@circuitsoul/db';
import { initializeTelemetry } from '@circuitsoul/observability';
import { processAIGenerationJob } from './job-processor';
import { createJobLog } from './persistence-layer';
import { startBillingAggregatorSchedule } from './billing-aggregator';
import type { JobContext } from './types';

// ─── Configuration (from environment, no shared mutable state) ────────────────

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const aggregatorIntervalMs = parseInt(process.env.AGGREGATOR_INTERVAL_MS || '60000', 10);

function getRedisConnection(): ConnectionOptions {
  try {
    const parsed = new URL(redisUrl);
    const port = Number(parsed.port || 6379);
    const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace('/', '') : '';
    const db = pathname ? Number(pathname) || 0 : 0;

    return {
      host: parsed.hostname || '127.0.0.1',
      port,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db
    } as ConnectionOptions;
  } catch {
    return {
      host: '127.0.0.1',
      port: 6379
    } as ConnectionOptions;
  }
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

const telemetry = initializeTelemetry({ serviceName: 'ai-worker' });

// ─── Worker Bootstrap ─────────────────────────────────────────────────────────

function startWorker() {
  const connection = getRedisConnection();

  // Create the AI generation worker with configurable concurrency
  const worker = createAIGenerationWorker(
    async (job) => {
      const jobId = job.id ?? 'unknown';

      // Build immutable per-job context — no shared state between jobs
      const ctx: JobContext = {
        jobId,
        attemptsMade: job.attemptsMade + 1,
        queueName: 'ai-generation',
        timestamp: Date.now()
      };

      console.log(
        `[ai-worker] Processing job ${ctx.jobId} (attempt ${ctx.attemptsMade}, concurrency=${concurrency})`
      );

      await processAIGenerationJob(job.data, ctx);
    },
    connection,
    { concurrency }
  );

  // Dead letter queue for exhausted retries
  const dlq = createDeadLetterQueue(connection);

  // ── Event Handlers ────────────────────────────────────────────────────────

  worker.on('completed', (job) => {
    console.log(`[ai-worker] Job completed: ${job.id}`);
  });

  worker.on('failed', async (job, err) => {
    const jobId = job?.id ?? 'unknown';
    console.error(`[ai-worker] Job failed: ${jobId}`, err?.message ?? err);

    const attempts = job?.opts?.attempts ?? 0;
    const made = job?.attemptsMade ?? 0;

    if (job && attempts > 0 && made >= attempts) {
      // Move to DLQ for manual inspection
      await dlq.add(
        'dlq',
        {
          originalJob: job.data,
          jobId,
          error: err?.message ?? String(err)
        },
        { removeOnComplete: true }
      );

      await createJobLog({
        jobId,
        queueName: 'ai-generation',
        jobName: 'ai-generation-request',
        attempt: made,
        status: 'DLQ',
        error: err?.message ?? String(err),
        payload: job.data
      });
    }
  });

  // ── Billing Aggregator ────────────────────────────────────────────────────

  const { worker: aggregatorWorker } = startBillingAggregatorSchedule(
    connection,
    aggregatorIntervalMs
  );

  console.log(
    `[ai-worker] Started with concurrency=${concurrency}, aggregator interval=${aggregatorIntervalMs}ms`
  );

  // ── Graceful Shutdown ─────────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    console.log(`[ai-worker] Received ${signal}, shutting down gracefully...`);

    // Drain: finish current jobs, stop accepting new ones
    await worker.close();
    await aggregatorWorker.close();
    await telemetry.shutdown();
    await prisma.$disconnect();

    console.log('[ai-worker] Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startWorker();
