# CircuitSoul Repository Audit Report

**Branch:** `hardening/stage1-security-remediation` (based on `stage1/security-foundation`)
**Audit Date:** 2026-11-02
**Auditor:** Principal Engineer / Technical Co-founder

## Repository Overview

CircuitSoul is a Turborepo monorepo using pnpm workspaces, Next.js 14, TypeScript, Prisma/PostgreSQL, and BullMQ/Redis. It provides digital infrastructure products for African SMEs: Shield (security), CloudOps (operations), Flow (automation), Blog (content), and Web (landing/pricing).

### Monorepo Structure

```
apps/
├── web/         # Landing page, pricing, middleware
├── shield/      # Security scans, NDPR reports, vulnerability dashboard
├── cloudops/    # Infrastructure metrics, cost optimization
├── flow/        # n8n workflow automation
├── blog/        # Ghost CMS publishing, AI content generation
└── admin/       # System control room (placeholder)

packages/
├── ui/          # Shared React components (Card, Button, Navbar)
├── auth/        # Session auth, RBAC, org membership verification
├── db/          # Prisma schema, Prisma client, tenant isolation helpers
├── ai/          # OpenAI service wrapper with mock fallbacks
├── security/    # NDPR compliance evaluator, HMAC gateway, encryption
├── api-adapters/# n8n, Wazuh, Prometheus, Ghost adapters
├── shared-types/# Zod validation schemas
├── config/      # ESLint, Tailwind, TypeScript base configs
├── events/      # BullMQ queues, event bus, job types
├── feature-flags/# In-memory feature flag client
├── observability/# OpenTelemetry bootstrap
├── reporting/   # PDFKit report generation
└── storage/     # S3-compatible storage client

services/
└── internal/ai-worker/  # BullMQ worker for AI generation + billing aggregation

infra/
├── docker-compose.yml   # PostgreSQL, Redis, n8n, Ghost, Wazuh, Prometheus
└── docker/Dockerfile.app # Next.js multi-stage build

configs/
└── docker-env.example   # OSS engine configuration template (placeholders only)
```

## Branch Comparison

| Branch | Commit | Description |
|--------|--------|-------------|
| `master` | bd29b31 | Original monorepo with blog/flow features |
| `stage1/security-foundation` | 007adb1 | Security fixes: auth, tenant isolation, adapter hardening, server-side routes |
| `hardening/stage1-security-remediation` | (working) | Current branch: additional P0 fixes on top of stage1 |

## Current Architecture

### Application Boundaries

- **Next.js apps** handle presentation and application APIs
- **Shared packages** contain reusable domain logic
- **Prisma** is accessed server-side only (after remediation)
- **OSS engines** accessed through server-side adapters
- **AI providers** accessed server-side
- **Customer data** is tenant-scoped via `createTenantClient` and `assertOrganizationMembership`

### Authentication Flow

1. Client sends session token via `Authorization: Bearer`, cookie, or `x-circuitsoul-session` header
2. `parseSession()` verifies HMAC signature or Clerk JWT
3. `requireAuthenticatedOrg()` verifies DB membership against `Membership` table
4. Route handlers use organization-scoped Prisma queries

### Authorization Model

- Roles: `OWNER`, `ADMIN`, `MEMBER`
- Permissions: `VIEW_ORG`, `MANAGE_WORKFLOWS`, `PUBLISH_CONTENT`, `MANAGE_ASSETS`
- Permission matrix maps each permission to allowed roles
- `switchOrganization()` verifies DB membership before org context switch

## Implemented Features

### Fully Implemented and Verified

| Feature | Location | Status |
|---------|----------|--------|
| HMAC session signing (SHA-256, timing-safe) | `packages/auth/src/index.ts` | Verified (tests pass) |
| Session expiration validation | `packages/auth/src/index.ts` | Verified |
| Clerk JWT verification with orgId requirement | `packages/auth/src/index.ts` | Verified (tests pass) |
| DB-backed org membership verification | `packages/auth/src/index.ts`, `packages/db/src/tenant.ts` | Verified (tests pass) |
| Tenant-scoped Prisma queries (all models) | `packages/db/src/tenant.ts` | Verified (tests pass) |
| Cross-tenant access denial | `packages/db/src/tenant.ts` | Verified (tests pass) |
| Org switching with DB verification | `packages/auth/src/index.ts` | Verified (tests pass) |
| Permission-based access control | `packages/auth/src/index.ts` | Verified (tests pass) |
| Mock engines disabled by default | `packages/api-adapters/src/index.ts` | Verified |
| No silent mock fallback on engine failure | `packages/api-adapters/src/*.ts` | Verified |
| Ghost JWT generation per spec | `packages/api-adapters/src/ghost.ts` | Verified |
| n8n webhook-based workflow execution | `packages/api-adapters/src/n8n.ts` | Verified |
| Shield server-side API routes | `apps/shield/app/api/*` | Verified |
| CloudOps server-side API routes | `apps/cloudops/app/api/*` | Verified |
| CloudOps client uses server APIs (not direct adapters) | `apps/cloudops/app/page.tsx` | Verified |
| Shield client uses server APIs (not direct adapters) | `apps/shield/app/page.tsx` | Verified |
| API route session middleware | `apps/web/middleware.ts` | Verified |
| Prisma migrations scripts | `packages/db/package.json` | Verified |
| Prisma schema valid | `packages/db/prisma/schema.prisma` | Verified |
| AES-256-GCM credential encryption | `packages/security/src/encryption.ts` | Verified |
| CI pipeline (GitHub Actions) | `.github/workflows/ci.yml` | Verified |
| Cross-tenant isolation tests | `packages/db/src/__tests__/tenant-isolation.test.ts` | Verified |
| Secrets removed from git tracking | `configs/docker-env` (git-removed) | Verified |
| Placeholder secrets in env files | `.env.example`, `configs/docker-env.example` | Verified |

### Partially Implemented

| Feature | Location | Gap |
|---------|----------|-----|
| Shield vulnerability scanning | `apps/shield/app/api/vulnerabilities/route.ts` | Requires asset authorization (fixed); actual Wazuh integration unverified without live engine |
| NDPR compliance assessment | `packages/security/src/ndpr.ts` | Self-reported only; no verified infrastructure telemetry |
| AI remediation recommendations | `packages/ai/src/index.ts` | Mock fallback when OpenAI key unavailable |
| CloudOps metrics | `apps/cloudops/app/api/metrics/route.ts` | Mock fallback when Prometheus unavailable |
| CloudOps optimization | `apps/cloudops/app/api/optimize/route.ts` | Mock fallback when OpenAI key unavailable |
| Flow workflow CRUD | `apps/flow/app/api/workflows/route.ts` | Mock fallback when n8n unavailable |
| Blog AI generation | `apps/blog/app/api/generate/route.ts` | Mock fallback when OpenAI key unavailable |
| Blog Ghost publishing | `apps/blog/app/api/publish/route.ts` | Mock fallback when Ghost unavailable |
| Asset registration | `apps/shield/app/api/assets/route.ts` | Implemented but no scan linkage |

### Mocked Features

| Feature | Location | Mock Behavior |
|---------|----------|---------------|
| n8n workflows | `packages/api-adapters/src/mocks/n8n.mock.ts` | In-memory arrays; used when `USE_MOCK_ENGINES=true` |
| Wazuh vulnerabilities | `packages/api-adapters/src/mocks/wazuh.mock.ts` | Hardcoded CVE list |
| Prometheus metrics | `packages/api-adapters/src/mocks/prometheus.mock.ts` | Random values |
| Ghost posts/trends | `packages/api-adapters/src/mocks/ghost.mock.ts` | Curated demo data |
| AI generation | `packages/ai/src/index.ts` | Hardcoded mock responses |
| Admin dashboard data | `apps/admin/app/page.tsx` | Hardcoded organizations and logs |

### Missing Features

- No Prisma migration files (directory created, scripts added, needs `prisma migrate dev` against live DB)
- No secret scanning pre-commit hook
- No CSRF protection
- No rate limiting
- No structured logging
- No backup/recovery strategy
- No Grafana dashboards
- No OpenCost integration
- No real Google Trends ingestion (curated demo data only)
- No real RSS ingestion
- No editorial approval workflow for blog
- No payment provider integration (Stripe/Paystack/Flutterwave)
- No NGN pricing (Plan.currency defaults to USD)
- No encrypted credential storage at rest (encryption utility created, not yet wired to CloudEnvironment writes)

## Critical Security Findings (All Fixed)

| Finding | Severity | Fix Applied |
|---------|----------|-------------|
| CloudOps client imported adapters directly (credential exposure) | P0 | Page rewritten to use server-side `/api/cloudops/*` routes |
| Shield vulnerabilities API accepted arbitrary `agentId` (no asset auth) | P0 | Route now requires `assetId` with verified `isAuthorized=true` before scan |
| `parseSession` accepted `x-circuitsoul-org-id` header override (org spoofing) | P0 | Header override removed; orgId only from verified session token |
| `USE_MOCK_ENGINES` defaulted to `true` (mock in production) | P0 | Default changed to `false` |
| Silent mock fallback on engine failure | P0 | All fallbacks removed; errors propagate |
| `resolveActiveOrganization` auto-selected first membership | P0 | Now requires explicit `organizationId` |
| Secrets in `.env.example` and `configs/docker-env.example` | P0 | Replaced with `CHANGE_ME_*` placeholders |
| `configs/docker-env` tracked in git | P0 | Removed from tracking, added to `.gitignore` |
| No CI/CD pipeline | P0 | GitHub Actions workflow created |
| No cross-tenant isolation tests | P0 | 8 tests added covering all tenant-scoped models |

## Build and Runtime Issues

- **No local database**: Prisma validation requires `DATABASE_URL`; schema is valid but migrations cannot be generated without a live PostgreSQL instance
- **No Docker**: Docker is not available in this environment; `docker-compose.yml` cannot be tested locally
- **Next.js builds**: Not run due to missing database and environment variables; build configuration exists in `turbo.json` and `Dockerfile.app`

## Database Gaps

| Gap | Status |
|-----|--------|
| Prisma migration files | Migration directory created; scripts added to package.json; needs `prisma migrate dev` against live DB |
| `CloudEnvironment.credentialsJson` plaintext | Encryption utility created; application-level encryption not yet wired to writes |
| `ShieldAssessment.overallRisk` free-form String | Still unenummed (lower priority) |
| `SecurityConsultingRequest.status` free-form String | Still unenummed (lower priority) |
| No organization-level subscription limit enforcement | Not implemented |
| `AiGeneration.userId` relation to User | Fixed |
| `ShieldAssessment.createdBy` relation to User | Fixed |

## Infrastructure Gaps

| Gap | Status |
|-----|--------|
| Docker images unpinned (`latest`) | n8n and Prometheus use `latest` tags |
| Wazuh image outdated (`4.3.10` EOL) | Still uses old Wazuh ODFE image |
| No app containers in docker-compose | Only OSS engines defined, no Next.js app containers |
| No health checks on app containers | N/A (no app containers) |
| Redis/PostgreSQL publicly exposed | Ports exposed in docker-compose (dev only) |
| No backup strategy | Not documented |
| No monitoring/alerting | Prometheus container present, no Grafana or alerting |

## Prioritized Remediation Plan

### Stage 1: Critical Foundation (COMPLETED on this branch)
- ✅ Auth: org membership verification, org switching, permission matrix
- ✅ API adapters: mock default false, no silent fallback
- ✅ Tenant isolation: all models covered, cross-tenant tests
- ✅ Server-side routes: Shield and CloudOps pages use fetch to server APIs
- ✅ Middleware: session verification for protected API routes
- ✅ Prisma schema: credential encryption fields, enum statuses, User relations
- ✅ Prisma migrations: directory and scripts created
- ✅ CI pipeline: GitHub Actions workflow
- ✅ Secrets: removed from git, placeholders in env files
- ✅ Credential encryption: AES-256-GCM utility created

### Stage 2: Remaining P0/P1 (Not Yet Started)
- Wire credential encryption to CloudEnvironment write paths
- Add CSRF protection for cookie-authenticated requests
- Add rate limiting by IP and organization
- Create Prisma migration files with `prisma migrate dev` (requires live DB)
- Add secret scanning to pre-commit/CI
- Pin Docker image versions
- Replace outdated Wazuh image
- Add NGN pricing support
- Add payment provider integration points

### Stage 3: Product Readiness (Shield First)
- Complete Shield asset-to-assessment workflow
- Persist assessment results to PostgreSQL
- Add PDF report download
- Add assessment history
- Add consulting request flow
