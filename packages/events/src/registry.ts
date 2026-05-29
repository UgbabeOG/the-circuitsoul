export const Events = {
  AIGenerationV1: 'ai-generation.v1',
  UsageEventV1: 'usage-event.v1',
  UsageAggregationV1: 'usage-aggregation.v1'
} as const;

export type EventsEnum = typeof Events[keyof typeof Events];

// ─── AI Generation Event ──────────────────────────────────────────────────────

export interface AIGenerationV1Payload {
  idempotencyKey: string; // client-provided idempotency key
  organizationId: string;
  userId?: string | null;
  prompt: string;
  generationType: string; // e.g. 'BLOG_CONTENT'
  metadata?: Record<string, unknown>;
}

// ─── Usage Event ──────────────────────────────────────────────────────────────

export interface UsageEventV1Payload {
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

// ─── Usage Aggregation Event ──────────────────────────────────────────────────

export interface UsageAggregationV1Payload {
  processedCount: number;
  recordsUpserted: number;
  errors: string[];
  timestamp: number;
}

// ─── Event Payload Map ────────────────────────────────────────────────────────

export interface EventPayloadMap {
  'ai-generation.v1': AIGenerationV1Payload;
  'usage-event.v1': UsageEventV1Payload;
  'usage-aggregation.v1': UsageAggregationV1Payload;
}

export type EventName = keyof EventPayloadMap;
export type PayloadFor<N extends EventName> = EventPayloadMap[N];

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isAIGenerationV1(obj: any): obj is AIGenerationV1Payload {
  return !!obj && typeof obj.idempotencyKey === 'string' && typeof obj.organizationId === 'string' && typeof obj.prompt === 'string';
}

export function isUsageEventV1(obj: any): obj is UsageEventV1Payload {
  return !!obj && typeof obj.organizationId === 'string' && typeof obj.eventType === 'string' && typeof obj.tokensUsed === 'number';
}