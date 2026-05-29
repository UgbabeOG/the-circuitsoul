export const Events = {
  AIGenerationV1: 'ai-generation.v1'
} as const;

export type EventsEnum = typeof Events[keyof typeof Events];

export interface AIGenerationV1Payload {
  idempotencyKey: string; // client-provided idempotency key
  organizationId: string;
  userId?: string | null;
  prompt: string;
  generationType: string; // e.g. 'BLOG_CONTENT'
  metadata?: Record<string, unknown>;
}

export interface EventPayloadMap {
  'ai-generation.v1': AIGenerationV1Payload;
}

export type EventName = keyof EventPayloadMap;
export type PayloadFor<N extends EventName> = EventPayloadMap[N];

export function isAIGenerationV1(obj: any): obj is AIGenerationV1Payload {
  return !!obj && typeof obj.idempotencyKey === 'string' && typeof obj.organizationId === 'string' && typeof obj.prompt === 'string';
}