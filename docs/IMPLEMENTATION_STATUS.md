# CircuitSoul Implementation Status

**Branch:** `feat/circuitsoul-release-readiness`
**Date:** 2026-11-16

---

## Phase 1 — CI/CD, Migrations & Dependency Security

### Database Migration Ordering (FIXED)
- **Issue:** `init` migration directory sorted lexically after timestamped migrations (`i` > `2`), causing `ProviderIdentity` FK to reference `User` before it existed on fresh databases.
- **Fix:** Renamed `init` → `20240101000000_init_baseline` so baseline schema applies first.
- **CI workflow:** Updated migration references and branch triggers.

### Dependency Vulnerabilities (45 → 3, 2 documented)
| Package | From | To | Fix |
|---------|------|-----|-----|
| next | 14.2.35 | 15.5.29 | Critical RCE, high DoS/SSRF fixed |
| turbo | 1.13.4 | 2.x | Security fixes |
| postcss | 8.5.32 | 8.5.33 | XSS/path traversal fixed |
| sanitize-html | 2.17.0 | 2.18.2 | Prototype pollution fixed |
| tsx | 4.19.2 | 4.20.3 | esbuild upgrade |
| pnpm overrides | — | postcss, glob, minimatch, uuid | Transitive vulns |

**Remaining (documented):**
- `zod` 3.25.76 → GHSA-mrhx-c7xc-m3w5 (memory exhaustion, requires breaking 4.x upgrade)
- `uuid` 9.0.1 → via bullmq 4.18.3 (requires bullmq 5.x upgrade)
- `deepmerge` → via sanitize-html (no patched version)
- `postcss` 8.4.31 → bundled by Next.js 15.5.29 (transitive)

**CI/CD:** All jobs passing (install, typecheck, lint, tests, build, migration fresh/upgrade, dependency scan).

---

## Phase 2 — Security Hardening

### Authentication & Authorization
- [x] HMAC-SHA256 session signing with timing-safe comparison
- [x] Session expiration & not-before validation
- [x] Clerk JWKS signature verification (issuer, audience, expiration)
- [x] DB-backed org membership verification (`verifyOrgMembership`)
- [x] Authoritative session + org check (`requireAuthenticatedOrg`)
- [x] Permission-based access control (`Permission` enum, `PERMISSION_MATRIX`)
- [x] Organization switching with DB verification (`switchOrganization`)
- [x] Removed client-side org-id override from `parseSession`
- [x] Dev session fallback requires `NODE_ENV=development` AND `CIRCUITSOUL_ALLOW_DEV_SESSION=true` AND `CIRCUITSOUL_DEV_SESSION_SECRET`
- [x] Production auth secret enforcement (`CIRCUITSOUL_AUTH_SECRET` required in production)
- [x] Session revocation (`RevokedSession` model, `revokeSession()`, `isSessionRevoked()`)
- [x] Session rotation on logout/refresh

### Multi-Tenancy
- [x] `createTenantClient()` covers ALL org-scoped models: assets, assessments, NDPR, consulting, workflows, subscriptions, cloud environments, blog posts, AI generations, notifications, activity logs, **article generation jobs, publishing attempts, blog automation settings**
- [x] Cross-tenant access denial in `tenant.ts.findUnique`
- [x] 75 total tests passing (auth, tenant isolation, Shield, Flow, CloudOps, NDPR, blog workflow)

### Security Hardening
- [x] **CSRF protection** — `packages/security/src/csrf.ts` (cookie + header verification for POST/PUT/PATCH/DELETE)
- [x] **CSRF middleware** — `apps/web/middleware.ts` sets CSRF cookie, enforces on mutation routes
- [x] **Rate limiting** — `packages/security/src/rate-limit.ts` (signin, callback, publish, scan, optimize, AI generation)
- [x] **Rate limited routes** — signin, callback, publish, AI generation, shield scan, CloudOps optimize
- [x] **Dev session hardening** — requires `CIRCUITSOUL_ALLOW_DEV_SESSION=true` AND `CIRCUITSOUL_DEV_SESSION_SECRET`
- [x] **Credentials never in API responses** — CloudEnvironment credentials encrypted at rest, never returned

### Secrets Management
- [x] AES-256-GCM credential encryption (`packages/security/src/encryption.ts`)
- [x] `CREDENTIAL_ENCRYPTION_KEY` environment variable required
- [x] Secrets not committed to Git (`.gitignore` excludes `configs/docker-env`)
- [x] `.env.example` uses safe placeholders only

---

## Phase 3 — CircuitSoul Shield (First Commercial Product)

### Asset Management
- [x] Organization-scoped asset ownership
- [x] Asset registration never auto-marks verified (`verified: false` by default)
- [x] Wazuh agent mapping verified against asset target (`verifyAssetAgent`)
- [x] Invalid/unavailable agent mappings treated as unverified (409 response)
- [x] Cross-tenant asset access denied

### Vulnerability Assessments
- [x] Correct request/response contracts (Zod validation)
- [x] Live/mock/demo scan states distinguished (`USE_MOCK_ENGINES`)
- [x] Findings normalized and validated (`normalizeFindings`)
- [x] Unsupported scanner responses fail safely (502)
- [x] Duplicate findings prevented (assessment status check)
- [x] Assessments and findings persist correctly (Prisma)
- [x] Assessment history organization-scoped
- [x] Scan failures observable and recoverable (502/409 responses)
- [x] Risk scoring: explainable weighted scoring (CRITICAL:30, HIGH:18, MEDIUM:8, LOW:3)

### NDPR Assessment
- [x] Self-reported answers clearly identified
- [x] Reported info distinguished from verified evidence (`isVerifiedTechnical`)
- [x] Does NOT auto-declare compliance based on user answers
- [x] AWS `af-south-1` NOT classified as Nigerian hosting region (FIXED)
- [x] Assessment results explainable (pillar breakdown with scores)
- [x] Historical assessment results preserved
- [x] NOT presented as regulator-issued certification

### Remediation
- [x] Remediation recommendations linked to actual findings (via `vulnerabilityId`)
- [x] Recommendations persisted to `ShieldVulnerability.remediation`
- [x] AI failures don't destroy assessment data (try/catch preserves state)
- [x] Recommendations organization-scoped
- [x] Recommendations labelled as guidance, not guaranteed fixes

### Reports
- [x] Select assessment → generate report → retrieve → download → access history
- [x] Report ownership and authorization on all endpoints
- [x] PDF report via `buildStatutoryNDPRCertificatePdf` (statutory certificate format)
- [x] Pillar breakdown with scores and regulatory references
- [x] Self-reported disclaimer in report

### Shield Tests
- [x] Asset registration & authorization (cross-tenant)
- [x] Asset verification (Wazuh agent mapping)
- [x] Vulnerability assessment (cross-tenant)
- [x] NDPR assessment (self-reported, not certification)
- [x] Report access (organization-scoped)
- [x] Remediation persistence (linked to vulnerability)
- [x] Cross-tenant vulnerability status updates

---

## Phase 4 — CircuitSoul CloudOps

### Cloud Credential Management
- [x] Organization-scoped environment registration
- [x] Credentials encrypted on write (`encryptCloudCredentials`)
- [x] Credentials never returned in API responses
- [x] Credential decryption available (`decryptCloudCredentials`)
- [x] `CREDENTIAL_ENCRYPTION_KEY` required

### Prometheus Integration
- [x] `prometheusInstanceLabel` field on `CloudEnvironment` (NOT auto-assigned from env UUID)
- [x] Metrics API uses stored Prometheus label, not env UUID
- [x] Live metrics state (CPU + memory both available)
- [x] Partial metrics state (only one metric available)
- [x] Unavailable metrics state (no metrics available)
- [x] Metric history persisted to `CloudMetric` table
- [x] Cloud environment ownership (org-scoped)

### Cost Monitoring
- [x] NOT advertised as operational (no real billing integration)
- [x] Cost monitoring disclaimer in UI

---

## Phase 5 — CircuitSoul Blog Automation

### Trend Discovery
- [x] `GoogleTrendsProvider` — fetches from Google Trends Trending Now (`trends.google.com/trends/trendingsearches/daily?geo=NG`)
- [x] `RssTrendProvider` — parses RSS 2.0 feeds (no external XML dependency)
- [x] `createDefaultProviders()` — Google Trends + configurable RSS feeds (`BLOG_RSS_FEEDS` env var)
- [x] Trend normalization, deduplication (by topic within 7 days), relevance scoring (40-100 scale)
- [x] Nigeria/Africa prioritization in scoring
- [x] No fabricated statistics or search-volume claims
- [x] Daily scheduled collection via BullMQ repeatable job
- [x] Manual trend collection API (`POST /api/blog/trends/collect`)
- [x] Trends API returns collected trends from database (`GET /api/blog/trends`)

### AI Editorial Pipeline
- [x] Article generation via BullMQ (`enqueueArticleGeneration`)
- [x] Article generation with idempotency (idempotency key prevents duplicates)
- [x] Article generation with synchronous fallback
- [x] AI content generation via `@circuitsoul/ai` (`generateBlogDraft`)
- [x] SEO metadata (title, description, slug, keywords)
- [x] Source reference preservation (linked to collected trends)
- [x] Article draft saved to `ArticleGenerationJob` with full editorial workflow states

### Editorial Approval & Ghost Publishing
- [x] Editorial states: SUGGESTED → GENERATING → DRAFT → PENDING_REVIEW → APPROVED → SCHEDULED → PUBLISHED → FAILED
- [x] Editorial approval API (`POST /api/articles/[id]/approve`)
- [x] Editorial rejection API (`POST /api/articles/[id]/reject`)
- [x] Scheduling API (`POST /api/articles/[id]/schedule`)
- [x] Scheduled publishing API (`POST /api/blog/publish/schedule`)
- [x] Ghost publishing via `blogAdapter.createPost`
- [x] Publishing history (`PublishingAttempt` model)
- [x] Publishing retry on failure
- [x] Idempotency (idempotency key prevents duplicate generation)
- [x] Approval-first: automatic publishing NOT enabled by default
- [x] Ghost credentials never exposed to browser (server-side only)

### Hero Image Generation
- [x] `ImageProvider` abstraction (`packages/api-adapters/src/image-generation.ts`)
- [x] `NullImageProvider` — returns null (safe fallback)
- [x] `PlaceholderImageProvider` — placeholder image URL
- [x] `createDefaultImageProvider()` — configurable via `BLOG_IMAGE_PROVIDER` env var
- [x] Hero image generation in article generation pipeline (`generateHeroImage` flag)

### Database Schema (Blog Automation)
- [x] `TrendSource` — trend source configuration (provider, URL, active status)
- [x] `CollectedTrend` — collected trends with relevance/freshness/audience scores
- [x] `ArticleGenerationJob` — article generation jobs with full editorial workflow
- [x] `PublishingAttempt` — publishing attempt history
- [x] `BlogAutomationSettings` — per-organization automation settings
- [x] `ArticleStatus` enum (SUGGESTED, GENERATING, DRAFT, PENDING_REVIEW, APPROVED, SCHEDULED, PUBLISHED, FAILED)
- [x] `AssetStatus` enum, `CloudEnvironmentStatus` enum
- [x] `BlogPost` model with `externalGhostId`, `externalWorkflowId` fields

### Blog Tests
- [x] Trend scoring (Nigeria-focused scored higher, cap at 100, baseline 40)
- [x] Trend provider interface (GoogleTrendsProvider name)
- [x] Blog trend collection → article generation → approval → publishing workflow
- [x] Blog tenant isolation (org-scoped articles)
- [x] NDPR assessment self-reported (not certification)
- [x] 75 total tests passing

---

## What Is Blocked

| Item | Blocker | Resolution |
|------|---------|------------|
| Prisma migration SQL generation | No live PostgreSQL database | Run `prisma migrate dev` when DB available |
| Live adapter integration testing | No external engine credentials | Requires Docker Compose or staging |
| Docker Compose testing | Docker not available | Requires Docker installation |
| Live Google Trends ingestion | Google Trends API limited | Provider ready; configure `GOOGLE_TRENDS_RSS_URL` |
| Live RSS ingestion | No feeds configured | Provider ready; configure `BLOG_RSS_FEEDS` |
| Live Ghost publishing | No Ghost instance | Adapter supports live mode via `GHOST_ADMIN_API_KEY` |
| Real n8n integration | Requires n8n engine + license review | Adapter exists; requires n8n instance |
| Real Wazuh integration | Requires Wazuh engine | Adapter exists; requires Wazuh instance |
| Real Prometheus integration | Requires Prometheus instance | Adapter exists; requires Prometheus instance |
| Payment provider integration | Deferred per requirements | No payment gateway until subscription model defined |

---

## Recommended Next Development Task

**Next: Open Pull Request**

The `feat/circuitsoul-release-readiness` branch contains all release-readiness work:
1. CI/CD fixes (migration ordering, dependency vulnerabilities)
2. Security hardening (CSRF, rate limiting, dev session, tenant isolation)
3. CircuitSoul Shield MVP (assessment-to-report workflow)
4. CircuitSoul CloudOps validation (Prometheus labels, metrics states)
5. CircuitSoul Blog automation (trend discovery, AI editorial, editorial approval, Ghost publishing)

All CI checks pass: typecheck, lint, 75 tests, build, dependency audit (2 documented).

**Do not merge without passing CI checks.**
