# Cofounder audit remediation prompt

You are the implementation owner for CircuitSoul. Work from the current GitHub release branch, not from assumptions about local-only changes. Start by checking the live GitHub branch heads and the working-tree diff. Do not overwrite or discard unrelated work.

## Objective

Close the cofounder audit's production blockers in severity order, prove the fixes with tests, and keep [AUDIT_REPORT.md](../AUDIT_REPORT.md) accurate. The audit found that GitHub branch tips still have account-impersonation, unauthenticated platform Admin, unauthenticated routes on `master`, and publicly bound database/cache ports. A local uncommitted remediation set exists on the current checkout; inspect and validate each change before relying on it. None of those changes are on GitHub until reviewed and pushed.

## Required sequence

### 1. P0: Identity and platform Admin access

- Ensure email alone can never create an account session. Require cryptographically verified provider proof and verified email; validate issuer, audience, expiry, state/nonce as applicable, and provider subject.
- Link provider subject to an internal user record; do not treat email as a durable identity key without a verified linking process.
- Make callback session issuance use current DB user, organization membership, and membership role.
- Protect the Admin page and every global-data Admin API with a fail-closed platform-admin authorization policy. Tenant OWNER/ADMIN must not automatically imply platform-admin access.
- Do not leak app session tokens into URLs, logs, or untrusted response contexts. Set secure, HttpOnly, SameSite cookies correctly.
- Add negative tests proving unauthenticated requests, arbitrary emails, unverified emails, invalid tokens, non-admin users, and nonmembers cannot mint sessions or read global data.

### 2. P0: Authentication and server-side actions on `master`

- Ensure session parsing accepts only cryptographically verified sessions; reject caller-controlled JSON session headers.
- Require verified authentication and current authorization before all Flow execute/toggle and Ghost publish operations.
- Scope workflow/resource lookups to current DB membership and organization.
- Ensure stale branches cannot be deployed or promoted; update branch protections/release workflow where appropriate.
- Run the same required CI workflow on pull requests targeting every protected/release branch, not only `master`.
- Add route-level cross-org denial and same-org success tests for every app and adapter path.

### 3. P1: Authorization, session lifecycle, and network exposure

- Derive every privileged role decision from the current DB membership role, not a stale token claim.
- Enforce revocation in ordinary protected-request authentication so logout and refresh invalidate the previous token.
- Test role downgrade, revoked membership, logout, refresh, expiry, and organization switch.
- Fix Flow status toggling to resolve an org-owned workflow and use its external n8n ID.
- Keep PostgreSQL and Redis on private/loopback networks; remove known development credentials from production paths and add Redis authentication if network-reachable.

### 4. P1/P2: Persistence, integrations, and launch readiness

- Verify credential encryption/decryption round trips and tamper rejection. Backfill existing values, remove plaintext storage paths, and document key rotation and recovery.
- Define whether Ghost is a shared publication target. Enforce the resulting ownership and visibility contract.
- Replace configuration-derived engine status with bounded live health checks and explicit unknown/unavailable states.
- Verify the local cloud credential AES-GCM fix with round-trip, tamper, and mismatched-IV tests; do not rely on it for live credentials until key lifecycle, backfill, and integration migration are verified.
- Verify clean-database and upgrade migrations; keep deploy migrations and security/test/build checks blocking in CI.
- Document production network boundaries, secret rotation, backup/restore drills, monitoring/alerts, incident response, supported versions, and data retention.
- Complete payment webhooks, billing lifecycle, and entitlement/quota enforcement before charging customers.

## Constraints

- Make small, reviewable changes and follow existing project patterns.
- Do not weaken authentication to simplify tests. Use test-only fixtures and secrets.
- Do not add credentials or real customer data to source, logs, issues, or reports.
- Do not claim production readiness based only on compilation or helper-level unit tests.
- Do not deploy or merge a branch with any unresolved P0 item.

## Validation and handoff

- Run the focused regression tests, full configured tests, type checks, lint, Prisma validation/migration checks, and production build.
- Add tests for every bug fixed and include cross-tenant negative cases.
- Report the exact branch and commit tested, modified files, commands/results, unverified live integrations, and remaining risks.
- Clearly separate local uncommitted fixes from GitHub branch heads; do not describe them as remotely fixed.
- Update the audit report with branch-specific statuses and evidence; do not say a finding is fixed until the fix is on the intended GitHub release branch.
