# Walkthrough: Event-driven AI workflow infrastructure

This file documents the changes added to the CircuitSoul monorepo to introduce an async AI generation pipeline, billing models, storage, reporting, feature flags, and observability scaffolding.

## Overview
- Implemented Prisma billing models: `Plan`, `Subscription`, `UsageRecord`.
- Added event & queue support using `bullmq` in `packages/events`.
- Added S3-compatible storage abstraction in `packages/storage`.
- Added reporting helpers (PDF generation) in `packages/reporting`.
- Added a minimal feature-flags client in `packages/feature-flags`.
- Added OpenTelemetry bootstrap in `packages/observability`.
- Added an internal AI worker service at `services/internal/ai-worker` that consumes AI generation jobs and persists results.
- Updated workspace configuration to include `services/**` in `pnpm-workspace.yaml`.

## Files added or modified
- Modified: `packages/db/prisma/schema.prisma` — added `Plan`, `Subscription`, `UsageRecord`, `BillingInterval`, `SubscriptionStatus`, and relations to `User` and `Organization`.
- Modified: `pnpm-workspace.yaml` — added `services/**` to workspace packages.
- Added: `packages/events/` — queue helpers and types (uses `bullmq`).
  - `packages/events/package.json`
  - `packages/events/src/index.ts`
- Added: `packages/storage/` — S3 adapter using AWS SDK.
  - `packages/storage/package.json`
  - `packages/storage/src/index.ts`
- Added: `packages/reporting/` — PDF generation and storage glue functions.
  - `packages/reporting/package.json`
  - `packages/reporting/src/index.ts`
- Added: `packages/feature-flags/` — lightweight feature flag client.
  - `packages/feature-flags/package.json`
  - `packages/feature-flags/src/index.ts`
- Added: `packages/observability/` — OpenTelemetry initialization helper.
  - `packages/observability/package.json`
  - `packages/observability/src/index.ts`
- Added: `services/internal/ai-worker/` — worker service that listens to AI generation queue and writes `AiGeneration` entries to the DB.
  - `services/internal/ai-worker/package.json`
  - `services/internal/ai-worker/src/index.ts`

## How the flow works
1. Client or service creates an AI generation job using the `packages/events` enqueue helper (`enqueueAIGenerationJob`).
2. Job is routed to a Redis-backed `bullmq` queue named `ai-generation`.
3. `services/internal/ai-worker` runs a Worker that processes jobs, calls the `@circuitsoul/ai` service, and writes `AiGeneration` records to the database via `@circuitsoul/db` (Prisma).
4. Generated assets (images, PDFs) should be uploaded to `@circuitsoul/storage` (S3 adapter) and referenced in DB records.

## Environment variables required for local testing
- `DATABASE_URL` — Postgres connection string used by Prisma
- `REDIS_URL` — Redis connection for BullMQ (e.g. `redis://127.0.0.1:6379`)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` — for `@circuitsoul/storage` (or use `S3_ENDPOINT` for S3-compatible services)
- `OPENAI_API_KEY` — for `@circuitsoul/ai` generation
- `OTEL_EXPORTER_OTLP_ENDPOINT` — (optional) OpenTelemetry endpoint

## Quick start / verification
1. Install dependencies (from repo root):

```bash
pnpm install
```

2. Push Prisma schema to the database (creates tables for new billing models):

```bash
npx prisma db push --schema=packages/db/prisma/schema.prisma
```

3. Build the AI worker and run it (in a shell where env vars are available):

```bash
cd services/internal/ai-worker
pnpm run build
pnpm start
```

4. Create a test job (example Node script) or enqueue from an app using `@circuitsoul/events` `enqueueAIGenerationJob` helper. Example (quick Node snippet):

```js
import { enqueueAIGenerationJob } from '@circuitsoul/events';

await enqueueAIGenerationJob({
  organizationId: 'org-id',
  userId: 'user-id',
  prompt: 'Write a product overview for CircuitSoul',
  generationType: 'BLOG_CONTENT'
});
```

5. Verify the worker logs show processing and the `AiGeneration` row exists in the database.

## Testing storage
- Use the `@circuitsoul/storage` API to upload/download a small file to the configured S3 bucket and confirm it is retrievable.

## Next recommended tasks
- Wire an enqueue endpoint in an app (e.g., `apps/web`) to call `enqueueAIGenerationJob` and return a job id.
- Add a small integration test that enqueues a job, waits for completion, and asserts a DB record exists.
- Add retention lifecycle and storage cleanup for generated assets to control costs.
- Add report metadata models (if structured metadata is required) and link reports to `Subscription` or `Organization` for billing.

---

If you want, I can now:
- Add a simple enqueue endpoint into `apps/web` and a small integration test, or
- Add Prisma migrations and run them against a dev DB if you provide credentials.
