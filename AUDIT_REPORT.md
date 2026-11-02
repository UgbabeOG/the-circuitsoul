# CIRCUITSOUL TECHNICAL AUDIT REPORT

**Date:** 2026-11-02  
**Auditor:** Kilo (Technical Co-founder / Principal Architect)  
**Repository:** the-circuitsoul (Turborepo monorepo, pnpm workspaces)  
**Status:** Pre-production, not commercially viable in current state

---

## 1. EXECUTIVE SUMMARY

CircuitSoul has a well-structured monorepo with the right conceptual boundaries (6 apps, 13 packages, 1 worker service, OSS engine adapters). The database schema is comprehensive. However, the codebase is **not production-ready**. Critical security vulnerabilities exist in authentication, multi-tenancy enforcement, secret management, and client-side exposure of infrastructure credentials. Several build errors exist. Mock data is the default in production-like configurations. Open-source engine adapters use incorrect API endpoints and silently fall back to mock data, violating the core requirement that production never silently returns mock data as real.

**Verdict:** Do not deploy or commercialize in current state. Stage 1 (foundation fixes) is required before any product feature work.

---

## 2. MONOREPO INTEGRITY

| Area | Status | Details |
|------|--------|---------|
| Turborepo | Implemented | `turbo.json` with build/lint/dev pipeline. Missing `test` and `typecheck` tasks. |
| pnpm workspace | Implemented | `pnpm-workspace.yaml` includes apps, packages, services. |
| Dependency management | Partial | Workspace:* used correctly. No lockfile validation in CI. Dockerfile uses `--frozen-lockfile`. |
| App boundaries | Partial | 6 Next.js apps, but pages call adapters directly from client components (boundary violation). |
| Shared packages | Implemented | ui, auth, db, ai, security, api-adapters, shared-types, reporting, storage, events, observability, feature-flags, config. |
| Unused packages | Partial | feature-flags, observability, config exist but are minimally integrated. |

**Package dependency graph issues:**
- `packages/auth` depends on `@circuitsoul/db` (Prisma) — auth should not depend on the DB layer; it should depend on shared-types only.
- `packages/api-adapters` index instantiates all 4 adapters at module load, regardless of which app uses them.
- `services/internal/ai-worker` has its own `node_modules` with symlinked workspace packages — not integrated into the root pnpm install.

---

## 3. FUNCTIONALITY CLASSIFICATION

### Fully Implemented (working code, though not necessarily production-secure)

1. **Prisma schema** — 20 models covering users, orgs, memberships, plans, subscriptions, usage, assets, assessments, vulnerabilities, cloud environments, workflows, executions, blog posts, AI generations, notifications, audit logs, job logs.
2. **Auth package** — HMAC-SHA256 signed session tokens, Clerk JWT verification path, RBAC (OWNER/ADMIN/MEMBER), `assertTenantAccess` guard, `requireSession`/`requireRole`/`requireMembership`.
3. **Auth tests** — One test file covering token verification, session parsing, role checks, tenant isolation.
4. **API adapters** — n8n, Wazuh, Prometheus, Ghost adapter classes with axios.
5. **AI service** — OpenAI wrapper with 3 generation methods (blog draft, remediation, cloud optimization) + mock fallbacks.
6. **AI worker** — BullMQ worker with idempotency, job logging, usage events, billing aggregator, DLQ, graceful shutdown.
7. **Reporting** — PDFKit-based PDF generation (NDPR certificate, executive summary).
8. **Storage** — S3-compatible client with presigned URLs.
9. **Security** — NDPR compliance evaluator (4 pillars), HMAC security gateway.
10. **Shield app API** — `GET/POST /api/assets` with org-scoped Prisma queries.
11. **Flow app API** — `GET/POST /api/workflows`, `POST /api/workflows/[id]/execute`, `POST /api/workflows/[id]/toggle`, `GET /api/executions`.
12. **Blog app API** — `POST /api/generate`, `GET/POST /api/posts`, `POST /api/publish`, `GET /api/trends`.
13. **UI package** — Card, Button, Navbar components with Tailwind.
14. **Frontend dashboards** — Shield, CloudOps, Flow, Blog, Admin client pages with mock data.

### Partially Implemented

1. **Authentication** — Session verification exists but:
   - `x-circuitsoul-session` header accepts any dotted string without strict validation.
   - Clerk path falls back to `orgId: 'default-org'` when no org claim exists — fabricates org membership.
   - No verification that session orgId matches an actual Membership record in DB.
   - No protected route middleware (Next.js middleware only sets cache headers).
   - `ALLOW_DEV_SESSION` returns hardcoded user/org in any non-production env.
2. **Multi-tenancy** — `createTenantClient` exists for assets, assessments, NDPr, consulting, workflows. NOT applied to: subscriptions, usage records, cloud environments, blog posts, AI generations, notifications, activity logs, vulnerabilities. Route handlers manually filter by orgId but no centralized enforcement.
3. **Mock mode** — `USE_MOCK_ENGINES` defaults to `true` (`!== 'false'`). Admin UI toggles it but it's a client-side state only, not server-enforced.
4. **Shield dashboard** — Client component calls `shieldAdapter` directly from the browser (credential exposure). Imports `generateNDPRReport`/`NDPRReport` from `@circuitsoul/security` which **do not exist** — build error.
5. **CloudOps dashboard** — Client component calls `opsAdapter` directly from the browser.
6. **n8n adapter** — Implements create/get/toggle/trigger/executions but uses incorrect n8n API endpoints (n8n has no `/workflows/{id}/trigger` or `/activate` REST endpoints in this form).
7. **Ghost adapter** — JWT generation matches Ghost spec. Falls back to `'mock_ghost_admin_token'` when key missing — silent failure.
8. **Wazuh adapter** — Auth token + vulnerability/syscollector endpoints. Falls back to mock on any error — silent.
9. **Prometheus adapter** — Correct PromQL queries. Falls back to random mock values — silent.
10. **Billing** — Plan, Subscription, UsageRecord, UsageEvent models exist. No enforcement, no payment provider integration, no NGN pricing mechanism, no entitlement checks.

### Mocked (no real backend integration)

1. **All OSS engine adapters** — `mockN8n`, `mockWazuh`, `mockPrometheus`, `mockGhost` with in-memory arrays.
2. **AI service** — Mock blog drafts, remediation plans, cloud optimization when OpenAI key absent or on error.
3. **Dev session** — Hardcoded `user-dev-uuid-001` / `org-dev-uuid-100`.
4. **Admin dashboard** — Hardcoded organizations and audit log entries.
5. **Prometheus metrics** — `Math.random()` values.

### Placeholder Interfaces (declared, not wired)

1. **feature-flags** — In-memory client, not connected to any app or DB.
2. **observability** — OpenTelemetry bootstrap function, not initialized in any app entrypoint.
3. **api-adapters** — Adapter interface exists but no app server-side route uses them (all app routes use Prisma directly or client components call adapters).
4. **storage** — S3 client exists but no app route uploads/downloads objects.

### Missing Functionality

1. **No route protection middleware** — Any API route is accessible without a session if `parseSession` isn't called (some routes may forget).
2. **No CSRF protection** on state-changing endpoints.
3. **No rate limiting** on any API.
4. **No credential encryption** — `CloudEnvironment.credentialsJson` stored plaintext.
5. **No Prisma migrations** — Only `prisma db push` (not production-safe).
6. **No CI/CD** — No GitHub Actions workflows.
7. **No tests** beyond the single auth test file. No API integration, DB integration, E2E, or tenant isolation tests.
8. **No editorial approval** for blog — publish button sends directly to Ghost.
9. **No real Google Trends ingestion** — `blogAdapter.getTrends()` returns curated mock data.
10. **No real RSS ingestion** — Not implemented.
11. **No NGN pricing** — `Plan.currency` defaults to USD, no currency switching.
12. **No payment provider** — Stripe/Paystack/Flutterwave not integrated (correctly deferred per requirements).
13. **No backup/recovery strategy** documented.
14. **No Docker health checks** on app containers.
15. **No standalone Next.js output** — Dockerfile references `.next/standalone` but `output: 'standalone'` not configured in next.config.

---

## 4. CRITICAL SECURITY VULNERABILITIES (P0)

### P0-1: Client-side exposure of infrastructure credentials
**Severity:** Critical  
**Location:** `apps/shield/app/page.tsx`, `apps/cloudops/app/page.tsx`  
**Description:** Shield and CloudOps pages are `"use client"` components that import and call `shieldAdapter` / `opsAdapter` directly from the browser. These adapters read `N8N_API_KEY`, `WAZUH_USER/PASSWORD`, `GHOST_ADMIN_API_KEY`, `PROMETHEUS_API_URL` from environment variables at build time and embed them in the client bundle. Any user can inspect browser network traffic and source to extract engine credentials.  
**Requirement:** All OSS engine calls must be server-side only, behind authenticated CircuitSoul API routes. Client components must call `/api/*` routes, never adapters directly.

### P0-2: Default mock mode in production-like config
**Severity:** Critical  
**Location:** `packages/api-adapters/src/index.ts:6`  
**Description:** `USE_MOCK_ENGINES = process.env.USE_MOCK_ENGINES !== 'false'` means mocks are ON by default. `.env.example` sets `USE_MOCK_ENGINES=true`. If deployed without explicitly setting `USE_MOCK_ENGINES=false`, the platform returns fabricated vulnerability lists, workflow executions, and cost metrics as if they were real customer data.  
**Requirement:** Default must be `false` (live engines required). Production must fail closed if a live engine is unreachable, never silently return mock data.

### P0-3: Session orgId is trusted without DB verification
**Severity:** Critical  
**Location:** `packages/auth/src/index.ts`  
**Description:** `parseSession` returns `orgId` from the signed token/JWT. Route handlers use `session.orgId` directly in Prisma `where` clauses without verifying that the user actually has a `Membership` record for that organization. A forged or stolen token with any orgId grants access to that org's data.  
**Requirement:** On every request, verify session orgId against `Membership` table (userId + organizationId). Reject if no membership exists.

### P0-4: Clerk integration fabricates org membership
**Severity:** Critical  
**Location:** `packages/auth/src/index.ts:77`  
**Description:** `verifyClerkJwt` sets `orgId: orgId || 'default-org'` when no org claim exists. This invents an organization that does not exist in the database, bypassing multi-tenancy entirely.  
**Requirement:** Clerk org membership must be verified against Clerk's membership API or the local Membership table. No fallback to fabricated org IDs.

### P0-5: Plaintext credential storage
**Severity:** Critical  
**Location:** `packages/db/prisma/schema.prisma:286`  
**Description:** `CloudEnvironment.credentialsJson` stores cloud provider API keys/credentials in plaintext.  
**Requirement:** Encrypt at rest using server-side encryption (AES-256-GCM or envelope encryption with a KMS). Never store plaintext secrets.

### P0-6: Secrets committed to git
**Severity:** Critical  
**Location:** `configs/docker-env` (committed, contains `GHOST_ADMIN_API_KEY`, `WAZUH_PASSWORD`, `N8N_BASIC_AUTH_PASSWORD`)  
**Description:** Real-looking secrets are committed to the repository.  
**Requirement:** Remove `configs/docker-env` from git, add to `.gitignore`, use only `docker-env.example` with placeholder values. Rotate all exposed secrets.

### P0-7: No CSRF protection
**Severity:** Critical  
**Location:** All state-changing API routes (`POST`, `PUT`, `DELETE`)  
**Description:** No CSRF tokens or SameSite cookie enforcement.  
**Requirement:** Implement CSRF protection for cookie-based sessions, or require `Authorization: Bearer` headers for all state-changing API calls (which also mitigates CSRF).

### P0-8: No rate limiting
**Severity:** Critical  
**Location:** All API routes  
**Description:** No rate limiting on auth, asset creation, workflow execution, blog publishing, or scanning endpoints.  
**Requirement:** Implement rate limiting per organization and per IP.

---

## 5. OPEN-SOURCE INTEGRATION STATUS

| Engine | Version Pinned | License Verified | Adapter Correct | Mock Fallback | Commercial Rights |
|--------|---------------|-----------------|-----------------|---------------|-------------------|
| n8n | No (`latest`) | Not verified | **No** — wrong endpoints | Yes (silent) | Fair-code (restricts commercial SaaS use) |
| Ghost | `5-alpine` | Not verified | Yes (JWT per spec) | Yes (silent) | AGPL/GPL |
| Wazuh | `4.3.10` (old/EOL) | Not verified | Partially | Yes (silent) | GPLv2 |
| Prometheus | No (`latest`) | Not verified | Yes (PromQL) | Yes (silent) | Apache 2.0 |

**Critical OSS findings:**

1. **n8n licensing (P0):** n8n is fair-code licensed (not OSI open source). Using n8n as the execution engine for a commercial SaaS may violate n8n's license terms. Must verify n8n's commercial licensing conditions before production use. Consider self-hosted n8n enterprise license or an alternative (e.g., Windmill, ActivePieces, or custom worker).

2. **n8n API endpoints incorrect (P0):** The `N8nAdapter` calls `POST /workflows/{id}/trigger` and `POST /workflows/{id}/activate`. n8n's REST API does not expose these endpoints. Execution is triggered via webhooks (`/webhook/{id}`), and activation is done via the API at `/workflows/{id}` with `active` field. The adapter will fail against a real n8n instance.

3. **Wazuh version EOL (P1):** `wazuh/wazuh-odfe:4.3.10` is based on OpenDistro for Elasticsearch (EOL). Current Wazuh uses a different architecture (indexer + dashboard + server). The adapter endpoints (`/vulnerability/{agentId}`, `/syscollector/{agentId}/scan`) may not match current Wazuh API.

4. **Silent mock fallback (P0):** All four adapters catch errors and return mock data without propagating failure. Violates the requirement: "If a live engine fails in production, return a proper error. Never silently return mock data."

5. **No pinned commits (P1):** Docker images use `latest` tags. No submodules pin specific versions despite `services/README.md` describing submodule intent. No submodules actually exist in `services/`.

6. **Ghost AGPL (P1):** Ghost is AGPL-licensed. Using Ghost as a backend API (not modifying source) is generally acceptable for SaaS, but must be documented. If CircuitSoul modifies Ghost source, those modifications must be released under AGPL.

---

## 6. DATABASE AND BILLING GAPS

| Gap | Severity | Details |
|-----|----------|---------|
| No Prisma migrations | P0 | Only `prisma db push` available. Not production-safe. No `prisma/migrations/` directory. |
| Credentials plaintext | P0 | `CloudEnvironment.credentialsJson` unencrypted. |
| No membership verification | P0 | Session orgId not checked against `Membership` table. |
| Currency hardcoded USD | P1 | `Plan.currency @default("USD")`. No NGN support or multi-currency mechanism. |
| No entitlement model | P1 | `Plan.features` is `Json?` but no code reads it to enforce limits. |
| No payment provider IDs | P1 | Subscription lacks Stripe customer ID, subscription ID, payment method. |
| UsageRecord not period-bound | P1 | No `billingPeriodStart`/`billingPeriodEnd` on UsageRecord. |
| ShieldAssessment.status is String | P2 | Free-form string instead of enum. |
| AiGeneration.userId not related | P2 | `userId` is plain String, no relation to `User` model. |
| No organization subscription limit enforcement | P1 | No code checks if org exceeds plan limits (workflows, assessments, AI generations). |

---

## 7. DEPLOYMENT READINESS

| Area | Status |
|------|--------|
| Docker Compose | Partial — engines defined, no app containers, no networking to Next.js apps |
| Dockerfile.app | Present but references `.next/standalone` without `output: 'standalone'` in next.config |
| CI/CD | Missing — no GitHub Actions workflows |
| Health checks | Only on postgres/redis in compose; none on apps |
| Backup strategy | Missing |
| Monitoring | Prometheus container present, no Grafana, no alerting, no OpenCost |
| Logging | No structured logging, no log aggregation |
| Environment validation | No startup validation that required secrets are present in production |

---

## 8. RANKED FINDINGS SUMMARY

### P0 — Critical (must fix before any production use)

1. **P0-1** Client-side infrastructure credential exposure (shield, cloudops pages)
2. **P0-2** Default mock mode (`USE_MOCK_ENGINES` defaults to true)
3. **P0-3** Session orgId not verified against Membership table
4. **P0-4** Clerk fabricates `default-org` when no org claim
5. **P0-5** Plaintext credentials in `CloudEnvironment.credentialsJson`
6. **P0-6** Secrets committed to git (`configs/docker-env`)
7. **P0-7** No CSRF protection
8. **P0-8** No rate limiting
9. **P0-9** Build error: shield page imports non-existent `generateNDPRReport`/`NDPRReport` from `@circuitsoul/security`
10. **P0-10** n8n fair-code license — commercial SaaS use must be verified
11. **P0-11** Silent mock fallback in all OSS adapters (violates production honesty requirement)

### P1 — High (fix before product launch)

1. **P1-1** No Prisma migrations (only db push)
2. **P1-2** No membership verification middleware
3. **P1-3** No NGN pricing / multi-currency support
4. **P1-4** No entitlement/limit enforcement from plans
5. **P1-5** No payment provider IDs on subscriptions
6. **P1-6** Wazuh image is EOL version
7. **P1-7** Docker images unpinned (`latest`)
8. **P1-8** No CI/CD pipeline
9. **P1-9** No editorial approval for blog publishing
10. **P1-10** No real Google Trends / RSS ingestion
11. **P1-11** n8n adapter uses incorrect API endpoints
12. **P1-12** No tests beyond single auth unit test

### P2 — Medium (fix before beta)

1. **P2-1** `ShieldAssessment.status` should be enum
2. **P2-2** `AiGeneration.userId` should relate to `User`
3. **P2-3** No backup/recovery documentation
4. **P2-4** No structured logging / log aggregation
5. **P2-5** No Grafana dashboards
6. **P2-6** feature-flags, observability packages unused

### P3 — Low (polish)

1. **P3-1** README outdated (mentions packages not in structure)
2. **P3-2** Dockerfile multi-stage build doesn't copy all workspace packages
3. **P3-3** No `.next/standalone` output config
4. **P3-4** Admin UI mock toggle is client-side only (no server effect)

---

## 9. BUILD ERROR CONFIRMATION

`apps/shield/app/page.tsx:7` imports `generateNDPRReport, NDPRReport` from `@circuitsoul/security`. The security package exports `evaluateNDPRCompliance`, `NDPRAssessmentInput`, `NDPRComplianceCertificate`, `NDPRCheckPillar`, `SecurityGateway`, `securityGateway`. **`generateNDPRReport` and `NDPRReport` do not exist.** This will cause a TypeScript/build failure.

---

## 10. RECOMMENDED IMPLEMENTATION ROADMAP

### Stage 1: Critical Foundation (P0 fixes) — FOR APPROVAL
Fix auth, security, multi-tenancy, remove mock defaults, encrypt credentials, fix build error, add route protection.

### Stage 2: Shield Product (P1)
Complete Shield with real scanner integration, NDPR reports, PDF exports, consulting requests.

### Stage 3: Flow Product (P1)
Fix n8n adapter endpoints, real n8n integration, workflow DB persistence, usage tracking.

### Stage 4: Blog Product (P2)
Real Google Trends ingestion, RSS ingestion, editorial approval, Ghost publishing.

### Stage 5: CloudOps Product (P2)
Real Prometheus integration, cloud environments, encrypted credentials, cost analytics.

### Stage 6: Operations (P2)
Prisma migrations, CI/CD, tests (unit, integration, E2E, tenant isolation), monitoring, backup.

---

## 11. STAGE 1: CRITICAL FOUNDATION — PROPOSED IMPLEMENTATION PLAN

**Objective:** Make the codebase secure, buildable, and mock-safe before building product features.

**Files to modify:**

1. `packages/api-adapters/src/index.ts` — Change `USE_MOCK_ENGINES` default to `false`. Remove silent mock fallback; throw errors on live engine failure.
2. `packages/api-adapters/src/n8n.ts` — Fix API endpoints to match real n8n REST API (webhook trigger, PATCH workflow active flag).
3. `packages/auth/src/index.ts` — Add `verifyMembership` function; remove `default-org` fallback; require DB membership check.
4. `packages/auth/src/index.ts` — Add production guard: throw if `CIRCUITSOUL_AUTH_SECRET` missing in production; remove `ALLOW_DEV_SESSION` in production.
5. `packages/db/src/tenant.ts` — Expand `createTenantClient` to cover all org-scoped models (subscriptions, usage, cloud envs, blog, AI gen, notifications).
6. `packages/db/prisma/schema.prisma` — Add encryption-related fields (optional: `credentialsEncrypted` + `credentialsIv`), change `ShieldAssessment.status` to enum, relate `AiGeneration.userId` to `User`.
7. `apps/shield/app/page.tsx` — Remove direct adapter import; call server API routes instead. Fix broken `generateNDPRReport` import.
8. `apps/cloudops/app/page.tsx` — Remove direct adapter import; call server API routes instead.
9. `apps/web/middleware.ts` — Add session verification middleware for protected routes.
10. `configs/docker-env` — Remove from git, add to `.gitignore`, rotate secrets.
11. `.env.example` — Set `USE_MOCK_ENGINES=false` by default, add required production secret placeholders.

**Testing strategy:**
- Run existing auth test
- Add tenant isolation tests (cross-org access attempts)
- Add auth middleware tests
- Verify TypeScript compiles across all packages and apps
- Verify build succeeds for shield and cloudops apps

**Breaking changes:** None to public API surface. `USE_MOCK_ENGINES` default changes from true to false (configuration change, not code-breaking). `ShieldAssessment.status` enum change requires migration.

**Expected impact:** Eliminates credential exposure, mock-in-production risk, cross-tenant data leakage, and build errors. Establishes secure foundation for Stages 2-6.

---

Please review this audit report and confirm whether you want me to proceed with **Stage 1: Critical Foundation**. I will create a feature branch and implement the P0 fixes upon your approval.