/**
 * AI Executor — Pure AI Execution Layer
 *
 * This module is responsible ONLY for making AI calls and returning results.
 * It has ZERO dependencies on @circuitsoul/db or @circuitsoul/storage.
 * It is fully stateless and safe for concurrent use.
 */

import { aiService } from '@circuitsoul/ai';
import type { AiExecutionResult } from './types';

/**
 * Execute an AI generation call based on the generation type.
 *
 * @param prompt - The user prompt to send to the AI model
 * @param generationType - The type of AI generation to perform
 * @param metadata - Optional metadata for context (future use: model selection, temperature, etc.)
 * @returns The AI response, token count, and generation time
 * @throws On AI service failure — the caller (job-processor) handles retries
 */
export async function executeAiGeneration(
  prompt: string,
  generationType: string,
  metadata?: Record<string, unknown>
): Promise<AiExecutionResult> {
  const startMs = Date.now();

  let response: string;

  switch (generationType) {
    case 'BLOG_CONTENT':
      response = await aiService.generateBlogDraft(
        prompt,
        prompt.split(' ').slice(0, 5)
      );
      break;

    case 'SHIELD_REMEDIATION': {
      const severity = (metadata?.severity as string) || 'MEDIUM';
      response = await aiService.recommendRemediation(prompt, severity);
      break;
    }

    case 'CLOUDOPS_RECOMMENDATION': {
      const provider = (metadata?.provider as string) || 'AWS';
      response = await aiService.recommendCloudOptimization(provider, prompt);
      break;
    }

    default:
      // Fallback to blog content generation for unknown types
      response = await aiService.generateBlogDraft(
        prompt,
        prompt.split(' ').slice(0, 5)
      );
      break;
  }

  const generationMs = Date.now() - startMs;

  return {
    response,
    tokenCount: estimateTokenCount(response),
    generationMs
  };
}

/**
 * Rough token estimation. In production, use the AI provider's
 * reported token usage from the response metadata.
 */
function estimateTokenCount(text: string): number {
  // Approximate: ~4 characters per token for English text
  return Math.max(Math.ceil(text.length / 4), 1);
}
