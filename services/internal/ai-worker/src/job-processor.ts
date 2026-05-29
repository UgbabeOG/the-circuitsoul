/**
 * Job Processor — Orchestration Layer
 *
 * Wires together ai-executor and persistence-layer.
 * This is the function that BullMQ's worker callback invokes.
 *
 * Responsibilities:
 * 1. Check idempotency via persistence-layer
 * 2. Call ai-executor for AI generation
 * 3. Save results via persistence-layer
 * 4. Emit UsageEvent via usage-emitter
 * 5. Log success/failure via persistence-layer
 *
 * Fully stateless — each invocation receives all context as parameters.
 */

import type { AiGenerationType } from '@circuitsoul/db';
import type { AIGenerationJobData } from '@circuitsoul/events';
import { executeAiGeneration } from './ai-executor';
import {
  checkIdempotency,
  saveGeneration,
  createJobLog
} from './persistence-layer';
import { emitUsageEvent } from './usage-emitter';
import type { JobContext } from './types';

/**
 * Process a single AI generation job.
 *
 * @param data - The job payload from the queue
 * @param ctx - Immutable job context (jobId, attempt, etc.)
 * @throws On unrecoverable failure — BullMQ handles retry via its own config
 */
export async function processAIGenerationJob(
  data: AIGenerationJobData,
  ctx: JobContext
): Promise<void> {
  const { idempotencyKey, organizationId, userId, prompt, generationType, metadata } = data;

  if (!idempotencyKey) {
    throw new Error('Missing idempotencyKey in job payload');
  }

  // ── Step 1: Idempotency Check ───────────────────────────────────────────
  const existing = await checkIdempotency(idempotencyKey, organizationId);

  if (existing) {
    console.log(
      `[job-processor] Duplicate job detected for idempotencyKey=${idempotencyKey}, skipping`
    );
    await createJobLog({
      jobId: ctx.jobId,
      queueName: ctx.queueName,
      jobName: 'ai-generation-request',
      attempt: ctx.attemptsMade,
      status: 'DLQ',
      payload: data
    });
    return;
  }

  const trimmedPrompt = (prompt || '').trim();

  try {
    // ── Step 2: AI Execution ──────────────────────────────────────────────
    const aiResult = await executeAiGeneration(
      trimmedPrompt,
      generationType,
      metadata
    );

    // ── Step 3: Persist Generation ────────────────────────────────────────
    const saved = await saveGeneration({
      organizationId,
      userId: userId ?? undefined,
      prompt: trimmedPrompt,
      response: aiResult.response,
      tokenCount: aiResult.tokenCount,
      type: generationType as AiGenerationType,
      idempotencyKey
    });

    // ── Step 4: Emit Usage Event ──────────────────────────────────────────
    await emitUsageEvent({
      organizationId,
      userId: userId ?? undefined,
      jobId: ctx.jobId,
      eventType: `AI_GENERATION:${generationType}`,
      tokensUsed: aiResult.tokenCount,
      storageBytes: Buffer.byteLength(aiResult.response, 'utf-8'),
      generationMs: aiResult.generationMs,
      jobsExecuted: 1,
      rawPayload: {
        generationId: saved.id,
        promptLength: trimmedPrompt.length,
        responseLength: aiResult.response.length
      }
    });

    // ── Step 5: Log Success ───────────────────────────────────────────────
    await createJobLog({
      jobId: ctx.jobId,
      queueName: ctx.queueName,
      jobName: 'ai-generation-request',
      attempt: ctx.attemptsMade,
      status: 'SUCCEEDED',
      payload: data
    });

    console.log(`[job-processor] AI generation completed: ${saved.id}`);
  } catch (err: any) {
    // ── Log Failure ───────────────────────────────────────────────────────
    await createJobLog({
      jobId: ctx.jobId,
      queueName: ctx.queueName,
      jobName: 'ai-generation-request',
      attempt: ctx.attemptsMade,
      status: 'FAILED',
      error: err?.message ?? String(err),
      payload: data
    });

    // Re-throw so BullMQ can handle retry logic
    throw err;
  }
}
