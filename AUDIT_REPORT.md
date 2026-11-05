# CircuitSoul co-founder audit

**Reassessed:** 2026-11-05
**Scope:** Current repository state, application APIs and dashboards, auth/tenant boundaries, adapters, persistence, tests, CI, and local deployment.
**Verdict:** The monorepo is buildable and has a useful product skeleton, but it is not ready for customer data or production use. The top blockers are concrete cross-tenant exposure paths, an incomplete user-authentication lifecycle, and infrastructure/application data that is not consistently tenant-bound. Treat this as a pre-production prototype.

## What changed since the previous audit

The November 2 report is stale in several places:

- The auth package now verifies DB-backed org membership, supports explicit org selection, and has role/permission helpers.
- Tenant-scoped DB helpers and isolation tests exist.
- API adapters are used server-side by routes; the old claim that Shield and CloudOps pages call adapters directly from the browser is no longer accurate.
- Mock engines are no longer enabled by the adapter package unless `USE_MOCK_ENGINES=true`.
- CI exists, the current focused test suite passes, and all seven Turborepo build tasks pass.
- The previous report's claims about the Clerk `default-org` fallback, absent CI, and the Shield page's missing export should not be used as current findings.

## Current validation

- `npm test`: **17 tests passed**. These are focused auth and tenant-helper tests, largely using mocked Prisma methods; they do not prove multi-tenant API behavior against a real database or engine.
- `npm run build`: **7/7 tasks passed**. This confirms compilation/buildability, not runtime integration, security, or product completeness.
- `git ls-files` found no tracked `configs/docker-env` or `.env` file. The Docker env file is ignored, but Compose requires it; a clean checkout may not be able to start the engine stack without creating it.
- The worktree already contained auth and Flow execution changes before this audit. Those were left untouched; build-generated `tsconfig` formatting and `next-env.d.ts` files were cleaned up.

## Ranked findings

### P0 — Do not expose to customer data

1. **Flow executions are not scoped to the user's organization.** The executions API validates that the caller belongs to an org, then passes an optional caller-provided `workflowId` to the shared n8n adapter. Without the query parameter, it requests engine-wide executions. The Flow workflow listing also returns the adapter's unscoped engine workflow list alongside org-scoped DB rows. Relevant files: `apps/flow/app/api/executions/route.ts`, `apps/flow/app/api/workflows/route.ts`.

2. **Shield vulnerability reads can bypass the asset authorization check.** `assetId` is optional on GET, and the route only checks asset ownership when it is supplied. The route then queries Wazuh using a caller-selected `agentId` (or a shared default), so any authenticated member can request engine vulnerability data without proving that the agent belongs to an authorized asset in that org. Relevant file: `apps/shield/app/api/vulnerabilities/route.ts`.

3. **Shared Ghost posts are returned without tenant mapping.** The blog posts API returns the shared Ghost adapter's complete post list to every authenticated org member, while only the separate Prisma list is org/user filtered. Publishing likewise writes to one shared Ghost installation without an org boundary. Relevant files: `apps/blog/app/api/posts/route.ts`, `apps/blog/app/api/publish/route.ts`, `packages/api-adapters/src/ghost.ts`.

4. **There is no complete production sign-in/session issuance path in this repo.** `signSessionToken` is only used by tests; there is no login/callback route or provider SDK wiring that establishes a verified user and issues the app session. Clerk verification is a token parser, not a complete provider integration. An externally trusted gateway could supply tokens, but that deployment contract is not implemented or documented end-to-end. Relevant file: `packages/auth/src/index.ts`; repository search found no app caller for `signSessionToken`.

### P1 — Fix before a usable beta

5. **Membership role checks have incompatible semantics and break legitimate access.** `assertOrganizationMembership` compares the DB role by exact inclusion. Many view routes pass `[Role.MEMBER]`, which rejects OWNER and ADMIN. Conversely, asset and workflow-management routes first require ADMIN/OWNER permission from the session but then also pass `[Role.MEMBER]` to the DB helper, rejecting those authorized roles too. Some endpoint combinations therefore deny all users. Define minimum-role/hierarchy semantics or pass the correct allowed roles consistently, and derive authorization from the DB membership role.

6. **Flow persistence is not mapped to the external workflow.** Workflow creation persists an internal DB ID without storing the adapter's external n8n ID. Execution looks up an org-scoped DB workflow but passes that internal ID to n8n. The adapter needs a durable external-ID mapping and tenant-safe execution lookup. Relevant files: `apps/flow/app/api/workflows/route.ts`, `apps/flow/app/api/workflows/[id]/execute/route.ts`, `packages/db/prisma/schema.prisma`.

7. **Active-org switching is not a user-facing lifecycle.** A header can select an org and DB membership is checked on protected routes, but there is no API/UI flow to list memberships, select an org, or refresh trusted session context. `switchOrganization` is only a helper, not an app endpoint or provider callback.

8. **Clerk JWT validation is incomplete.** Signature verification and an expiry check exist, but the code does not require `exp` or validate issuer/audience (and does not use a provider SDK/JWKS rotation path). Role claims are also consumed by route permission checks before the DB role is consulted. Complete provider-specific token validation and use current DB membership role for authorization. Relevant file: `packages/auth/src/index.ts`.

9. **Cloud metrics are not bound to an org-owned environment.** Any authenticated org member can supply an arbitrary `hostId`; absent one, the route queries a shared hard-coded host. There is no lookup proving that the host/environment belongs to the selected org. Relevant file: `apps/cloudops/app/api/metrics/route.ts`.

10. **Cloud credentials remain plaintext-capable.** The schema still has required `credentialsJson` plaintext alongside optional encrypted fields. Encryption helpers exist, but no migration or API integration was verified that encrypts on write and decrypts only for server-side engine calls. Relevant files: `packages/db/prisma/schema.prisma`, `packages/security/src/encryption.ts`.

11. **AI outages silently produce fabricated output.** The AI service returns mock content when the key is absent, a request fails, or the provider returns no content. In remediation and cloud optimization flows, this can be mistaken for real security or cost advice. Make mock mode explicit and visibly label provenance; production should surface provider failures. Relevant file: `packages/ai/src/index.ts`.

12. **CI can report success while important checks fail.** The workflow uses `|| true` for lint, Prisma migration status, and dependency audit; the root `test` script includes tenant tests, but CI runs only `test:auth`. Relevant file: `.github/workflows/ci.yml`.

13. **No production migration history or deployment procedure.** No Prisma migrations are tracked; README onboarding still directs operators to `prisma db push`. This is not a safe schema-evolution process for production. Relevant files: `packages/db/prisma/schema.prisma`, `README.md`.

### P2 — Product and operating readiness

14. **Admin dashboard is entirely local demo state.** Tenant records, audit logs, engine status, and the mock toggle are React state; the toggle does not change server adapter configuration. It must not be presented as a real control plane. Relevant file: `apps/admin/app/page.tsx`.

15. **Billing and entitlements are not operational.** Schema models exist, but there is no verified payment-provider lifecycle or enforcement of plan features/quotas at API boundaries.

16. **Product integrations need ownership boundaries and failure contracts.** Shared n8n, Wazuh, Prometheus, and Ghost adapters exist, but app resources are not consistently mapped to tenant-owned engine resources. Engine outages should fail explicitly rather than silently produce demo data.

17. **Local deployment is not reproducible from a fresh checkout.** `infra/docker-compose.yml` references an ignored `configs/docker-env` file and uses floating `latest` images; the Wazuh image is old. Add a committed safe example, pin supported image versions, and define health/readiness and secret provisioning.

18. **Test coverage is not yet a production gate.** There are no API integration tests exercising cross-org requests end-to-end, external adapter contract tests, browser journeys, or lifecycle tests for auth and membership changes.

## Recommended completion sequence

### Gate 0 — Tenant isolation and authorization

- Scope Flow executions and workflow lists to org-owned DB records; never expose global adapter results.
- Require a valid, org-owned asset/agent association on every Shield vulnerability read and scan.
- Decide whether Ghost is a shared publication target or tenant-isolated. Do not return shared content to every tenant by default.
- Fix role hierarchy/allowed-role semantics and make DB membership role authoritative.
- Bind CloudOps `hostId` to an org-owned `CloudEnvironment`.
- Add API-level regression tests proving cross-org requests are denied and same-org requests work.

### Gate 1 — Real identity and membership lifecycle

- Select and implement a complete identity-provider contract: sign-in/callback, issuer/audience/key rotation, session issuance/refresh/revocation, and logout.
- Add membership listing and active-org selection backed by DB membership checks.
- Add provisioning/invitation/removal lifecycle, with owner/admin authorization and audit events.
- Test org switching, revoked membership, stale role claims, expired tokens, and missing provider claims.

### Gate 2 — Secure persistence and honest integrations

- Migrate plaintext cloud credentials to encrypted storage; remove plaintext write paths and define key rotation/backup recovery.
- Make AI and adapter mock behavior explicitly development-only; return errors in production rather than success-shaped mock output.
- Store external engine IDs against org-owned records; validate all provider calls through that mapping.
- Add per-org usage/entitlement enforcement before paid or expensive operations.

### Gate 3 — Launch readiness

- Create and test Prisma migrations; remove `db push` from production instructions.
- Make CI enforce lint, typecheck, unit/integration tests, dependency scans, and production builds (no `|| true`).
- Pin deployment images; document secrets, backups/restore, health checks, alerts, incident response, and data retention.
- Complete user-facing onboarding, org switching, operational admin pages, and end-to-end journeys.

## Completion criteria

Do not call the app production-complete until all P0 findings are closed, P1 gates are implemented, CI runs the relevant security and integration suites as blocking checks, and staging tests demonstrate two separate organizations cannot read or mutate each other's resources across every app and external adapter.
