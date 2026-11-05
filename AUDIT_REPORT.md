# CircuitSoul co-founder technical audit

**Reassessed:** 2026-11-05
**Scope:** All current GitHub branch heads, authentication and tenant boundaries, application APIs, external adapters, credential persistence, CI, tests, and local deployment.
**Verdict:** **Not production-ready and not safe for customer data.** Local uncommitted changes mitigate several findings on the current checkout, but none have been pushed. The GitHub branch heads still contain the reported vulnerabilities; do not treat local fixes as deployed, merged, or production-verified.

## Branch coverage

GitHub lists three unique branch heads. Two additional local branch names are aliases for `master`, not additional GitHub branches.

| GitHub branch | Head | Result |
|---|---|---|
| `master` | `bd29b31` | P0 caller-controlled session header, unauthenticated Flow execution/toggle, and unauthenticated Ghost publishing. No sign-in/callback/refresh/logout routes at this tip. Branch unprotected. |
| `stage1/security-foundation` | `007adb1` | Fixes the `master`-specific session/action bypasses but retains stale-role authorization and publicly exposed PostgreSQL/Redis configuration. Branch unprotected. |
| `hardening/stage1-security-remediation` | `363a071` | Adds sign-in/callback and platform Admin surfaces, but has email-only session issuance, missing platform-admin authorization, stale-role authorization, ineffective revocation, and publicly exposed database/cache configuration. Branch unprotected. |

`feature/phase-1-foundation-and-shield` and `fix/security-auth-tenancy` locally point to the same commit as `master`. The remote heads remain at the hashes above. Only the current local working tree, based on `hardening/stage1-security-remediation`, was tested; older branch snapshots were not independently built. Branch-specific findings below describe the remote tips unless explicitly labeled local.

## Executive summary

### Critical blockers on GitHub

1. **Identity spoofing and unauthenticated platform-wide data access** remain on the remote `hardening/stage1-security-remediation` head.
2. **Forged-session header and unauthenticated Flow/Ghost operations** remain on remote `master`.
3. **PostgreSQL and Redis exposure risks** remain on the remote stage1 and remediation heads.
4. **No GitHub branch protections** are configured for the three unique branch heads.

### Local remediation state

The current working tree contains uncommitted fixes for email-only sign-in, Admin access, current-role authorization, revocation checks, Flow external-ID toggling, Compose network/auth settings, and cloud-credential decryption. The added unit tests and current local build pass. These changes have **not** been committed or pushed, and tests/builds do not establish live production security.

### High-priority residual gaps

- Provider identity is still matched by verified email rather than a durable provider-subject link; production-grade issuer/audience/expiry and signing-key rotation requirements remain.
- GitHub branch protection and pull-request CI coverage across release branches remain unaddressed.
- Docker Compose could not be validated because the Docker CLI is unavailable in this environment.
- Credential backfill, plaintext-field retirement, key rotation/recovery, and live integration validation remain incomplete.
- Route-level cross-tenant coverage, clean migration/release verification, engine health checks, and operational readiness remain incomplete.

## Branch findings

### P0 — Do not deploy the affected remote branch

1. **Email-only sign-in can impersonate users — remote `hardening/stage1-security-remediation`.** Its sign-in/callback flow can create a session without proving ownership of the supplied email. The local uncommitted change blocks custom email-only login and requires a signed provider token with verified email and database membership. It does not yet provide durable provider-subject linking or full production-grade issuer/audience/expiry/key-rotation guarantees. Files: [sign-in route](./apps/web/app/api/auth/signin/route.ts), [callback route](./apps/web/app/api/auth/callback/route.ts).

2. **Platform Admin data is unauthenticated — remote `hardening/stage1-security-remediation`.** The branch exposes global Admin data without a platform-admin check. The local uncommitted change applies a server-side exact-email allowlist and guards the Admin page and global-data APIs; tenant OWNER/ADMIN does not grant platform access. Configure `CIRCUITSOUL_PLATFORM_ADMIN_EMAILS` only on the Admin server. File: [platform-admin guard](./apps/admin/lib/platform-admin.ts).

3. **Forged session and unauthenticated server actions — remote `master` and aliases.** The master tip trusts a caller-controlled `x-circuitsoul-session` header and allows unauthenticated Flow execution/toggle and Ghost publishing. Later hardened branch code addresses these paths, but the fixes are not on remote `master`; do not deploy it. Files: [auth package](./packages/auth/src/index.ts), [Flow execute route](./apps/flow/app/api/workflows/%5Bid%5D/execute/route.ts), [Flow toggle route](./apps/flow/app/api/workflows/%5Bid%5D/toggle/route.ts), [Blog publish route](./apps/blog/app/api/publish/route.ts).

### P1 — Required before beta

4. **Stale role claims and ineffective revocation — remote stage1/remediation heads.** Token roles can be stale and revoked tokens can remain valid on protected requests. Local uncommitted auth changes require active sessions, check current database membership roles, reject revoked sessions on async protected API guards, and refresh using the current role. This does not put those controls on GitHub or prove every route/integration path is covered.

5. **Incomplete provider identity verification and linking.** The local callback requires a signed provider token and verified email, but still relies on email-to-user matching rather than a durable provider-subject mapping. Required issuer/audience/expiry validation and rotation-capable key verification are not fully established. File: [callback route](./apps/web/app/api/auth/callback/route.ts).

6. **Flow status toggle mapping — remote remediation head.** The local change resolves the organization-owned workflow and passes its external n8n ID to the adapter; an absent external mapping fails instead of silently using the internal ID. File: [Flow toggle route](./apps/flow/app/api/workflows/%5Bid%5D/toggle/route.ts).

7. **PostgreSQL/Redis network exposure — remote stage1/remediation heads.** The local Compose change binds published ports to loopback, requires database/cache passwords, and enables Redis authentication. Compose syntax/interpolation and runtime health checks remain unverified because Docker is unavailable. File: [Docker Compose](./infra/docker-compose.yml).

8. **Credential persistence and key lifecycle.** A local fix now verifies the stored IV metadata against the AES-GCM blob and decrypts using the embedded IV/tag/ciphertext format; regression tests cover round-trip, tampering, and mismatched IV metadata. Backfill/removal of plaintext storage, key rotation/recovery, and live integration migration remain open. File: [credential encryption](./packages/security/src/encryption.ts).

9. **GitHub protections and CI scope.** All three unique GitHub branches are unprotected, and the workflow PR filter targets only `master`. Configure required reviews/status checks and ensure relevant PR checks cover each protected/release branch.

10. **Organization lifecycle and cross-tenant route coverage.** Invitation/provisioning/removal, audit events, session invalidation, onboarding, and route-level same-org success/cross-org denial tests are incomplete. Existing configured tests emphasize helper behavior and mocks.

### P2 — Production and product readiness

11. **Live engine health is not established by the Admin dashboard.** Configuration/mock-mode labels are not evidence of live reachability. Add bounded health checks and explicit unknown/unavailable states.

12. **Ghost publication ownership is unresolved.** The app publishes to a shared Ghost installation. Decide whether this is intentionally a common destination and enforce the corresponding tenant ownership/visibility model.

13. **Production operations are not demonstrated.** Document and test ingress/network boundaries, secret provisioning and rotation, backups/restore, monitoring/alerts, incident response, data retention, and supported engine versions.

14. **Migration release flow needs proof.** Validate clean-database deployment and upgrades from a previous schema in CI using the actual deployment migration path.

15. **Billing and entitlements are incomplete.** Verify checkout, signed/idempotent webhooks, cancellation/renewal, and consistent quota enforcement end-to-end before charging customers.

## Local uncommitted remediation

The current local worktree is `hardening/stage1-security-remediation` tracking `origin/hardening/stage1-security-remediation`; all changes below remain uncommitted:

- Block email-only sign-in and require a signed provider token with verified email and active database membership for callback session creation.
- Add a fail-closed platform-admin allowlist for the Admin page and its global-data APIs.
- Enforce active-session/revocation checks and database-current roles in protected async API authorization; refresh with the current role.
- Fix Flow toggle to use the stored external workflow ID.
- Bind Compose-published ports to loopback, require PostgreSQL/Redis passwords, and enable Redis authentication; document local setup.
- Correct cloud credential decryption metadata validation and add AES-GCM round-trip/tamper regression coverage.

These are local mitigations only. They are not present on GitHub branch tips and are not evidence that production is secure.

## Validation

- `pnpm test`: **35 passed, 0 failed** (auth, identity/Admin policy, tenant-isolation, API, and credential-encryption tests).
- `pnpm build`: **7/7 workspace tasks successful**.
- `pnpm lint`: command exited successfully, but Turbo found no lint tasks configured; this is not lint coverage.
- `git diff --check`: passed.
- Docker Compose validation: **not run**; `docker` is unavailable.
- Live Clerk/JWKS behavior, real PostgreSQL tenant isolation, live engine behavior, deployment network boundaries, migrations, backup/restore, and production configuration were not verified.
- No changes have been committed, pushed, or deployed. These checks do not establish production readiness.

## Recommended next steps

### Gate 0 — Get reviewed fixes onto the intended release branch

1. Review and test the current uncommitted remediation, then commit and push it through the normal protected-branch review flow.
2. Port the hardened session parsing and authenticated/authorized Flow and Ghost operations to `master`, or retire/block `master` and aliases from deployment.
3. Configure GitHub protections and required CI on all protected/release branches; update pull-request workflow filters.
4. Keep production/customer data disabled until P0 fixes are present on the actual release branch and reviewed.

### Gate 1 — Close identity and tenant lifecycle gaps

1. Use rotation-capable provider verification with required issuer, audience, expiry, state/nonce checks as applicable.
2. Link provider subject to an internal user ID and define secure account provisioning and linking.
3. Add route-level tests for unauthenticated access, non-admin access, role downgrade, revocation, same-org success, and cross-org denial across apps/adapters.
4. Complete membership invitation, removal, audit trail, session invalidation, and organization onboarding.

### Gate 2 — Secure persistence and integrations

1. Backfill encrypted cloud credentials, remove plaintext storage, and document key rotation/recovery.
2. Validate Compose/network configuration and live service health checks in a Docker-capable staging environment.
3. Define Ghost publication ownership and enforce org-scoped resources at every integration boundary.

### Gate 3 — Launch readiness

1. Validate clean migration deployment and upgrades in CI.
2. Document and rehearse secret rotation, backup/restore, monitoring, incident response, retention, and supported versions.
3. Complete billing/webhooks/quotas and staging verification with at least two organizations across all routes/adapters.

## Reusable implementation prompt

See [COFOUNDER_AUDIT_NEXT_STEPS_PROMPT.md](./docs/COFOUNDER_AUDIT_NEXT_STEPS_PROMPT.md) for a copy-ready prompt that delegates the remaining remediation work.

## Completion criteria

Do not call the service production-ready until P0 fixes are on the actual GitHub release branch, stale branches cannot be deployed accidentally, identity and tenant controls have route-level negative tests, branch protection/CI and migration gates are verified, and staging evidence proves that separate organizations cannot read or mutate each other's resources across every app and external adapter.
