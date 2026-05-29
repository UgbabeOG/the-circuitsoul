import 'dotenv/config';
import { createAIGenerationWorker, createDeadLetterQueue } from '@circuitsoul/events';
import { prisma, AiGenerationType } from '@circuitsoul/db';
import { aiService } from '@circuitsoul/ai';
import { initializeTelemetry } from '@circuitsoul/observability';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const telemetry = initializeTelemetry({ serviceName: 'ai-worker' });

async function processAIGeneration(jobData: any, jobId: string, attemptsMade: number) {
  const data = jobData as any;

  const idempotencyKey: string = data.idempotencyKey;
  if (!idempotencyKey) {
    throw new Error('Missing idempotencyKey in job payload');
  }

  // Idempotency: if a generation with same idempotencyKey and org exists, skip
  const existing = await prisma.aiGeneration.findFirst({
    where: { idempotencyKey, organizationId: data.organizationId }
  });

  if (existing) {
    console.log(`Duplicate job detected for idempotencyKey=${idempotencyKey}, skipping`);
    await prisma.jobLog.create({
      data: {
        jobId,
        queueName: 'ai-generation',
        jobName: 'ai-generation-request',
        attempt: attemptsMade,
        status: 'DLQ',
        payload: data
      }
    });
    return;
  }

  const prompt = (data.prompt || '').trim();
  const generationType = data.generationType as AiGenerationType;
  let response = '';

  try {
    switch (generationType) {
      case AiGenerationType.BLOG_CONTENT:
        response = await aiService.generateBlogDraft(prompt, prompt.split(' ').slice(0, 5));
        break;
      default:
        response = await aiService.generateBlogDraft(prompt, prompt.split(' ').slice(0, 5));
        break;
    }

    const saved = await prisma.aiGeneration.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId ?? undefined,
        prompt,
        response,
        tokenCount: Math.max(response.length, 0),
        type: generationType,
        idempotencyKey
      }
    });

    await prisma.jobLog.create({
      data: {
        jobId,
        queueName: 'ai-generation',
        jobName: 'ai-generation-request',
        attempt: attemptsMade,
        status: 'SUCCEEDED',
        payload: data
      }
    });

    console.log(`AI generation completed: ${saved.id}`);
  } catch (err: any) {
    await prisma.jobLog.create({
      data: {
        jobId,
        queueName: 'ai-generation',
        jobName: 'ai-generation-request',
        attempt: attemptsMade,
        status: 'FAILED',
        error: err?.message ?? String(err),
        payload: data
      }
    });

    throw err;
  }
}

function startWorker() {
  const worker = createAIGenerationWorker(async job => {
    console.log(`Processing AI generation job ${job.id} (attempt ${job.attemptsMade + 1})`);
    await processAIGeneration(job.data, job.id, job.attemptsMade + 1);
  }, { url: redisUrl });

  const dlq = createDeadLetterQueue({ url: redisUrl });

  worker.on('completed', job => {
    console.log(`Job completed: ${job.id}`);
  });

  worker.on('failed', async (job, err) => {
    console.error(`Job failed: ${job?.id}`, err?.message ?? err);

    const attempts = job?.opts?.attempts ?? 0;
    const made = job?.attemptsMade ?? 0;

    if (job && attempts > 0 && made >= attempts) {
      // Move to DLQ for manual inspection
      await dlq.add('dlq', { originalJob: job.data, jobId: job.id, error: err?.message ?? String(err) }, { removeOnComplete: true });
      await prisma.jobLog.create({
        data: {
          jobId: job.id,
          queueName: 'ai-generation',
          jobName: 'ai-generation-request',
          attempt: made,
          status: 'DLQ',
          error: err?.message ?? String(err),
          payload: job.data
        }
      });
    }
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down AI worker...');
    await worker.close();
    await telemetry.shutdown();
    process.exit(0);
  });
}

startWorker();
