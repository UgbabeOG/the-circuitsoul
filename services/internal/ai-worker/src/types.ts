import type { ConnectionOptions } from 'bullmq';

// ─── Worker Configuration ─────────────────────────────────────────────────────

export interface WorkerConfig {
  /** Number of concurrent jobs this worker processes. Default: 5 */
  concurrency: number;

  /** BullMQ rate limiter — max N jobs per duration (ms) */
  limiter?: {
    max: number;
    duration: number;
  };

  /** How long a job can hold its lock before being considered stalled (ms) */
  lockDuration?: number;

  /** How often to check for stalled jobs (ms) */
  stalledInterval?: number;

  /** Redis connection options */
  connection: ConnectionOptions;
}

// ─── Job Context ──────────────────────────────────────────────────────────────

/**
 * Immutable context created per-job. Ensures no shared mutable state
 * between concurrent job executions, enabling horizontal scaling.
 */
export interface JobContext {
  readonly jobId: string;
  readonly attemptsMade: number;
  readonly queueName: string;
  readonly timestamp: number;
}

// ─── Queue Partitioning Scaffolding ───────────────────────────────────────────

/**
 * Future support for queue partitioning. Jobs can optionally carry
 * a partitionKey to route to specific queue partitions.
 */
export interface PartitionableJobData {
  partitionKey?: string;
}

// ─── AI Execution Result ──────────────────────────────────────────────────────

export interface AiExecutionResult {
  /** The generated AI response text */
  response: string;

  /** Approximate token count */
  tokenCount: number;

  /** Time taken for the AI call in milliseconds */
  generationMs: number;
}

// ─── Usage Event Data ─────────────────────────────────────────────────────────

export interface UsageEventData {
  organizationId: string;
  subscriptionId?: string;
  userId?: string;
  jobId?: string;
  eventType: string;
  tokensUsed: number;
  storageBytes: number;
  generationMs: number;
  jobsExecuted: number;
  rawPayload?: Record<string, unknown>;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

export interface AggregationResult {
  processedCount: number;
  recordsUpserted: number;
  errors: string[];
}
