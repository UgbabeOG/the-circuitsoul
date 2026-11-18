import { EventEmitter } from 'events';
import { Queue, Worker, Job, ConnectionOptions, JobsOptions, WorkerOptions } from 'bullmq';
import { PayloadFor, isAIGenerationV1 } from './registry';
import { enqueueArticleGeneration, processArticleGenerationJob, type ArticleGenerationInput } from './article-generation';
import { collectTrends, type CollectedTrendResult } from './trend-collection';
import { TrendProvider } from '@circuitsoul/api-adapters';
import { publishScheduledArticles, type ScheduledPublishingJobData } from './scheduled-publishing';

export { enqueueArticleGeneration, processArticleGenerationJob, collectTrends };
export type { ArticleGenerationInput, CollectedTrendResult };

export const AI_GENERATION_QUEUE_NAME = 'ai-generation';
export const AI_GENERATION_DLQ_NAME = 'ai-generation-dlq';
export const USAGE_AGGREGATION_QUEUE_NAME = 'usage-aggregation';
export const TREND_COLLECTION_QUEUE_NAME = 'trend-collection';
export const TREND_COLLECTION_DLQ_NAME = 'trend-collection-dlq';

export type TrendCollectionJobData = {
  organizationId: string;
  regionHint?: string;
  providerNames?: string[];
};

export type AIGenerationJobData = PayloadFor<'ai-generation.v1'>;

// ─── Worker Configuration ─────────────────────────────────────────────────────

export interface WorkerConfig {
  /** Number of concurrent jobs this worker processes. Default: 5 */
  concurrency?: number;

  /** BullMQ rate limiter — max N jobs per duration (ms) */
  limiter?: {
    max: number;
    duration: number;
  };

  /** How long a job can hold its lock before being considered stalled (ms) */
  lockDuration?: number;

  /** How often to check for stalled jobs (ms) */
  stalledInterval?: number;
}

// ─── Redis Connection ─────────────────────────────────────────────────────────

export const defaultRedisConnection = (): ConnectionOptions => {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  try {
    const parsed = new URL(redisUrl);
    const port = Number(parsed.port || 6379);
    const db = parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.replace('/', '')) || 0 : 0;

    return {
      host: parsed.hostname || '127.0.0.1',
      port,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db
    } as ConnectionOptions;
  } catch {
    return {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379)
    } as ConnectionOptions;
  }
};

// ─── EventBus ─────────────────────────────────────────────────────────────────

export class EventBus extends EventEmitter {}

export const eventBus = new EventBus();

// ─── Queue Factories ──────────────────────────────────────────────────────────

export function createQueue<T = unknown>(queueName: string, connection: ConnectionOptions = defaultRedisConnection()) {
  return new Queue<T>(queueName, { connection });
}

export function createDeadLetterQueue(connection: ConnectionOptions = defaultRedisConnection()) {
  return createQueue<any>(AI_GENERATION_DLQ_NAME, connection);
}

export function createAIGenerationQueue(connection: ConnectionOptions = defaultRedisConnection()) {
  return createQueue<AIGenerationJobData>(AI_GENERATION_QUEUE_NAME, connection);
}

export function createTrendCollectionQueue(connection: ConnectionOptions = defaultRedisConnection()) {
  return createQueue<TrendCollectionJobData>(TREND_COLLECTION_QUEUE_NAME, connection);
}

export function createUsageAggregationQueue(connection: ConnectionOptions = defaultRedisConnection()) {
  return createQueue<any>(USAGE_AGGREGATION_QUEUE_NAME, connection);
}

// ─── Job Options ──────────────────────────────────────────────────────────────

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000
  },
  removeOnComplete: true,
  removeOnFail: false
};

export { defaultJobOptions };

// ─── Enqueue ──────────────────────────────────────────────────────────────────

export async function enqueueAIGenerationJob(
  data: AIGenerationJobData,
  connection: ConnectionOptions = defaultRedisConnection(),
  opts: Partial<JobsOptions> = {}
) {
  if (!isAIGenerationV1(data)) {
    throw new Error('Invalid AI generation payload for v1');
  }

  const queue = createAIGenerationQueue(connection);
  await queue.add('ai-generation-request', data, { ...defaultJobOptions, ...opts });
}

export async function enqueueTrendCollection(
  data: TrendCollectionJobData,
  connection: ConnectionOptions = defaultRedisConnection(),
  opts: Partial<JobsOptions> = {}
) {
  const queue = createTrendCollectionQueue(connection);
  await queue.add('trend-collection-request', data, { ...defaultJobOptions, ...opts });
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

export function createAIGenerationWorker(
  processor: (job: Job<AIGenerationJobData>) => Promise<void>,
  connection: ConnectionOptions = defaultRedisConnection(),
  config: WorkerConfig = {}
) {
  const workerOptions: Partial<WorkerOptions> = {
    connection,
    concurrency: config.concurrency ?? 5,
    lockDuration: config.lockDuration,
    stalledInterval: config.stalledInterval,
    limiter: config.limiter
  };

  return new Worker<AIGenerationJobData>(
    AI_GENERATION_QUEUE_NAME,
    processor,
    workerOptions as WorkerOptions
  );
}

export function createTrendCollectionWorker(
  processor: (job: Job<TrendCollectionJobData>) => Promise<void>,
  connection: ConnectionOptions = defaultRedisConnection(),
  config: WorkerConfig = {}
) {
  const workerOptions: Partial<WorkerOptions> = {
    connection,
    concurrency: config.concurrency ?? 3,
    lockDuration: config.lockDuration,
    stalledInterval: config.stalledInterval,
    limiter: config.limiter
  };

  return new Worker<TrendCollectionJobData>(
    TREND_COLLECTION_QUEUE_NAME,
    processor,
    workerOptions as WorkerOptions
  );
}

export { publishScheduledArticles };
export type { ScheduledPublishingJobData };
