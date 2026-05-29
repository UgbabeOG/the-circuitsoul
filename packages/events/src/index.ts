import { EventEmitter } from 'events';
import { Queue, Worker, Job, QueueScheduler, ConnectionOptions, JobsOptions } from 'bullmq';
import { Events, PayloadFor, isAIGenerationV1 } from './registry';

export const AI_GENERATION_QUEUE_NAME = 'ai-generation';
export const AI_GENERATION_DLQ_NAME = 'ai-generation-dlq';

export type AIGenerationJobData = PayloadFor<'ai-generation.v1'>;

const defaultRedisConnection = (): ConnectionOptions => {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379)
  };
};

export class EventBus extends EventEmitter {}

export const eventBus = new EventBus();

export function createQueue<T = unknown>(queueName: string, connection: ConnectionOptions = defaultRedisConnection()) {
  new QueueScheduler(queueName, { connection });
  return new Queue<T>(queueName, { connection });
}

export function createDeadLetterQueue(connection: ConnectionOptions = defaultRedisConnection()) {
  return createQueue<any>(AI_GENERATION_DLQ_NAME, connection);
}

export function createAIGenerationQueue(connection: ConnectionOptions = defaultRedisConnection()) {
  return createQueue<AIGenerationJobData>(AI_GENERATION_QUEUE_NAME, connection);
}

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000
  },
  removeOnComplete: true,
  removeOnFail: false
};

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

export function createAIGenerationWorker(
  processor: (job: Job<AIGenerationJobData>) => Promise<void>,
  connection: ConnectionOptions = defaultRedisConnection()
) {
  // Worker will rely on the processor to handle idempotency and logging.
  return new Worker<AIGenerationJobData>(AI_GENERATION_QUEUE_NAME, processor, { connection });
}
