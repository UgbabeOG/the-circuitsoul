# CircuitSoul Security Remediation Report

## Platform Admin dashboard access

The Admin app displays platform-wide organization, user, environment, workflow,
assessment, and activity data. It requires a valid CircuitSoul session and an
exact email match in the server-only `CIRCUITSOUL_PLATFORM_ADMIN_EMAILS`
environment variable. Configure it as a comma-separated list, for example:

```dotenv
CIRCUITSOUL_PLATFORM_ADMIN_EMAILS="ops-admin@example.com,security-admin@example.com"
```

Do not use tenant `OWNER` or `ADMIN` roles as platform-admin grants. If the
variable is unset or empty, all users are denied access. The dashboard renders
a not-found response to unauthorized requests; its global-data APIs return
`401 Unauthorized` for missing/invalid sessions and `403 Forbidden` for
authenticated users outside the allowlist. Keep this variable in the server
environment only; do not expose it through a `NEXT_PUBLIC_` variable.

**Branch:** `hardening/stage1-security-remediation`
**Date:** 2026-11-02

## Security Findings and Fixes

### P0-1: Client-side Infrastructure Credential Exposure

**Severity:** Critical  
**Affected Files:** `apps/cloudops/app/page.tsx` (before fix)  
**Root Cause:** CloudOps dashboard was a `"use client"` component that imported `opsAdapter` from `@circuitsoul/api-adapters` and `aiService` from `@circuitsoul/ai` directly. These modules read `PROMETHEUS_API_URL`, `OPENAI_API_KEY`, and other credentials from environment variables at build time, embedding them in the client bundle.  
**Fix:** Rewrote `apps/cloudops/app/page.tsx` to call server-side API routes (`/api/cloudops/metrics`, `/api/cloudops/optimize`) via `fetch`. Removed all direct adapter and AI service imports from the client component.  
**Test Evidence:** All 16 unit tests pass. TypeScript type-checks cleanly.  
**Remaining Risk:** Verify no other client components import server-only modules. Shield page was already fixed on `stage1/security-foundation`. Flow and Blog pages need review.

### P0-2: Shield Vulnerabilities API — No Asset Authorization

**Severity:** Critical  
**Affected Files:** `apps/shield/app/api/vulnerabilities/route.ts`  
**Root Cause:** The GET and POST endpoints accepted an arbitrary `agentId` query/body parameter without verifying that the authenticated organization owned or authorized the corresponding asset. This allowed any org member to trigger scans against infrastructure they don't own.  
**Fix:** Added `authorizeAssetAccess()` function that requires `assetId` and verifies `isAuthorized=true` on the `Asset` record belonging to the organization before returning vulnerability data or triggering a scan. Scan triggers now also create a `ShieldAssessment` record in PostgreSQL.  
**Test Evidence:** Cross-tenant isolation tests verify `createTenantClient` scopes all queries to the organization.  
**Remaining Risk:** Actual Wazuh scanner integration is unverified (requires live Wazuh engine).

### P0-3: Session Org-ID Override via Header

**Severity:** Critical  
**Affected Files:** `packages/auth/src/index.ts`  
**Root Cause:** `parseSession()` accepted an `x-circuitsoul-org-id` header that overrode the orgId from the verified session token. A client could supply any orgId and bypass tenant isolation without DB membership verification.  
**Fix:** Removed the header override entirely. `parseSession()` now returns orgId only from the verified session token/JWT. Organization switching must go through `switchOrganization()` which calls `verifyOrgMembership()` against the database.  
**Test Evidence:** Replaced the org-override test with `switchOrganization` test that verifies DB membership before allowing org switch.  
**Remaining Risk:** None identified for this specific issue.

### P0-4: Default Mock Mode in Production-Like Config

**Severity:** Critical  
**Affected Files:** `packages/api-adapters/src/index.ts`  
**Root Cause:** `USE_MOCK_ENGINES` defaulted to `true` (`process.env.USE_MOCK_ENGINES !== 'false'`). If deployed without explicitly setting `USE_MOCK_ENGINES=false`, the platform would return fabricated data as if it were real.  
**Fix:** Changed default to `false` (`process.env.USE_MOCK_ENGINES === 'true'`).  
**Test Evidence:** Configuration change; verified by reading source.  
**Remaining Risk:** Deployments must explicitly set `USE_MOCK_ENGINES=false` in production.

### P0-5: Silent Mock Fallback on Engine Failure

**Severity:** Critical  
**Affected Files:** `packages/api-adapters/src/n8n.ts`, `packages/api-adapters/src/ghost.ts`  
**Root Cause:** All adapter methods caught errors from live engine API calls and silently returned mock data instead of propagating the error. This violates the requirement that production never silently returns mock data as real.  
**Fix:** Removed all try/catch mock fallback blocks. Live engine errors now propagate to the caller. Ghost `generateToken()` throws instead of returning `'mock_ghost_admin_token'` when credentials are missing.  
**Test Evidence:** TypeScript type-checks cleanly.  
**Remaining Risk:** Wazuh and Prometheus adapters already threw on failure (no change needed).

### P0-6: Secrets Committed to Git

**Severity:** Critical  
**Affected Files:** `configs/docker-env` (previously tracked), `.env.example`, `configs/docker-env.example`  
**Root Cause:** `configs/docker-env` contained real-looking secrets (`GHOST_ADMIN_API_KEY`, `WAZUH_PASSWORD`, `N8N_BASIC_AUTH_PASSWORD`) and was tracked in git. `.env.example` and `docker-env.example` contained real-looking default values.  
**Fix:** 
- Removed `configs/docker-env` from git tracking (`git rm --cached`)
- Added `configs/docker-env` to `.gitignore`
- Replaced all real-looking values in `.env.example` and `configs/docker-env.example` with `CHANGE_ME_*` placeholders  
**Test Evidence:** `git ls-files configs/` confirms only `docker-env.example` is tracked.  
**Remaining Risk:** Secrets may still exist in Git history. Repository owner must rotate all credentials that were ever committed.

### P0-6b: Credentials in Git History

**Severity:** Critical  
**Affected Files:** Git history (all branches)  
**Root Cause:** `configs/docker-env` was committed before being removed. Git history retains the secrets.  
**Fix:** Cannot remove from history without `git filter-branch` or `bfg` (destructive, requires approval).  
**Remaining Risk:** **Manual action required:** Repository owner must rotate all credentials that were committed to git:
- `GHOST_ADMIN_API_KEY` in `configs/docker-env`
- `WAZUH_PASSWORD` in `configs/docker-env`
- `N8N_BASIC_AUTH_PASSWORD` in `configs/docker-env`
- `N8N_API_KEY` in `.env.example` and `configs/docker-env.example`
- `CIRCUITSOUL_AUTH_SECRET` in `.env.example`
- `GATEWAY_SECRET_KEY` in `.env.example`
- `DATABASE_URL` password in `.env.example`

### P0-7: Auto-Selected Organization on Switch

**Severity:** High  
**Affected Files:** `packages/db/src/tenant.ts`  
**Root Cause:** `resolveActiveOrganization()` fell back to the user's first membership when no `organizationId` was provided, enabling implicit org switching without explicit user intent.  
**Fix:** Now requires explicit `organizationId` parameter. Throws `TenantAccessDenied: Organization ID must be explicitly provided for org switching.` if not provided.  
**Test Evidence:** Test verifies the function rejects undefined orgId.

### P0-8: Plaintext Cloud Credentials

**Severity:** High  
**Affected Files:** `packages/db/prisma/schema.prisma`  
**Root Cause:** `CloudEnvironment.credentialsJson` stored cloud provider API keys/credentials in plaintext.  
**Fix:** Added `credentialsEncrypted` and `credentialsIv` fields for AES-256-GCM encryption. Created `packages/security/src/encryption.ts` with `encryptCredential()`/`decryptCredential()` functions.  
**Remaining Risk:** Application-level encryption not yet wired to CloudEnvironment write paths. The `credentialsJson` plaintext field still exists for backward compatibility. Migration path needed: encrypt existing plaintext credentials, populate `credentialsEncrypted`/`credentialsIv`, then deprecate `credentialsJson`.

### P0-9: No Prisma Migrations

**Severity:** High  
**Affected Files:** `packages/db/package.json`, `packages/db/prisma/migrations/`  
**Root Cause:** Only `prisma db push` was available, which is not production-safe. No migration directory or scripts.  
**Fix:** Created `packages/db/prisma/migrations/` directory. Added `migrate:dev`, `migrate:deploy`, `migrate:status` scripts to `packages/db/package.json`.  
**Remaining Risk:** Migration SQL files need to be generated with `prisma migrate dev` against a live PostgreSQL database. Not done in this environment (no database available).

### P0-10: No CI/CD Pipeline

**Severity:** High  
**Affected Files:** `.github/workflows/` (did not exist)  
**Root Cause:** No automated testing, linting, type checking, or building on push/PR.  
**Fix:** Created `.github/workflows/ci.yml` with lint-and-typecheck, test, build, secret-scanning, and dependency-scan jobs.  
**Remaining Risk:** CI not yet run (requires repository push to GitHub).

### P0-11: No Cross-Tenant Isolation Tests

**Severity:** High  
**Affected Files:** `packages/auth/src/index.test.ts` (only auth tests existed)  
**Root Cause:** Only 5 auth unit tests existed. No tests verified that Organization A cannot access Organization B's data.  
**Fix:** Created `packages/db/src/__tests__/tenant-isolation.test.ts` with 8 tests covering:
- `assertTenantAccess` cross-tenant blocking
- `createTenantClient` query scoping for all 11 org-scoped models
- `createTenantClient` findUnique cross-tenant rejection
- `resolveActiveOrganization` explicit orgId requirement
- `resolveActiveOrganization` membership validation
- `assertOrganizationMembership` role checking  
**Test Evidence:** All 16 tests (8 auth + 8 tenant isolation) pass.

## Remaining Risks

| Risk | Severity | Status |
|------|----------|--------|
| Secrets in Git history | Critical | Manual rotation required by repository owner |
| Credential encryption not wired to writes | High | Application code needs to call `encryptCredential()` before storing |
| No CSRF protection | High | Not implemented |
| No rate limiting | High | Not implemented |
| No Prisma migration files | High | Requires live DB to generate |
| Outdated Wazuh image (EOL) | Medium | `wazuh/wazuh-odfe:4.3.10` is end-of-life |
| Unpinned Docker images | Medium | n8n and Prometheus use `latest` tags |
| No secret scanning pre-commit | Medium | CI has secret scan but no pre-commit hook |

## Manual Actions Required from Repository Owner

1. **Rotate all credentials** that were ever committed to git (see P0-6b list above)
2. **Generate Prisma migrations**: Run `pnpm --filter @circuitsoul/db migrate:dev` against a local PostgreSQL database, then commit the migration files
3. **Wire credential encryption**: Update CloudEnvironment create/update code paths to use `encryptCredential()` from `@circuitsoul/security`
4. **Rotate Docker Compose secrets**: Update `configs/docker-env` (local, gitignored) with real values for local development
5. **Review n8n licensing**: Verify commercial-use rights before using n8n as a SaaS execution engine
6. **Run CI**: Push branch to GitHub to trigger the CI pipeline
