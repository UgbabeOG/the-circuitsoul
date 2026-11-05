# CircuitSoul remediation audit

**Assessment date:** 2026-11-05
**Working branch:** `hardening/release-readiness-single-agent`
**Base:** `origin/agent2/ci-integration` at `ac4550f`
**Status:** Not production-ready. This report describes the current local
worktree, which still requires validation, review, commit, push, and a successful
GitHub Actions run. It is not evidence that remote branches or production have
been remediated.

## Remote branch inventory

The fetched remote heads at assessment time:

| Branch | Head |
|---|---|
| `master` | `bd29b31` |
| `stage1/security-foundation` | `007adb1` |
| `agent1/auth-security` | `a30c25e` |
| `agent2/ci-integration` | `ac4550f` |
| `hardening/stage1-security-remediation` | `a30c25e` |
| `hardening/stage2-remaining` | `a30c25e` |

This sprint is based on `agent2/ci-integration` and is limited to the single
requested work branch. No other implementation branch is created here. No
production branch is modified or merged.

## Worktree remediation

- **Authentication:** External Clerk JWT verification is separate from signed
  internal HMAC sessions. Provider subjects are durably linked to existing
  users; callback state is cookie-bound; session refresh/logout/revocation and
  current database membership roles are covered by tests. Platform Admin
  access is server-side allowlist-gated.
- **Shield:** Asset registration requires explicit authorization; scanning
  requires an organization-owned, UUID-addressed asset and verified scanner
  mapping. Assessments/findings are persisted; remediation is tied to a stored
  finding; NDPR assessments are labeled self-reported, and reports are
  organization-scoped.
- **CloudOps:** Environment access is organization-scoped. Credentials are
  encrypted on write and not returned to the frontend. Missing metrics are
  represented as unavailable instead of fabricated cost, uptime, or health.
- **Flow and Blog:** Workflow execution checks ownership and ACTIVE status.
  Blog publication validates publisher ownership and sanitizes content.
- **Credentials and CI:** A guarded plaintext-to-encrypted backfill, drop
  migration, workspace typecheck/lint, secret/dependency scan jobs, migration
  checks, and full build job are configured.

## Local validation status

Most recent local results:

- `pnpm test`: 35 passed, 0 failed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- Prisma schema validation: passed.
- Build, frozen install, dependency audit, clean/upgrade database migration,
  and real service integration still require completion.

No CI run has completed on this branch because it has not been pushed. Do not
claim CI success until the GitHub Actions run for the final commit is complete.

## Remaining risks and staging gates

1. Clerk browser sign-in is not implemented end-to-end, and OIDC nonce
   validation is not yet wired to a provider-issued challenge. State-cookie
   binding alone is not proof of nonce validation.
2. PostgreSQL-backed end-to-end tenant tests and real migration execution must
   be run. The credential backfill and destructive column retirement require a
   verified backup, approved change window, and staging rehearsal.
3. Live Wazuh agent mapping and scans, Prometheus metrics, n8n execution, Ghost
   publishing ownership, and real health checks have not been verified.
4. Cloud cost and other absent metrics remain unavailable; no cost/uptime/SLA
   source integration is claimed.
5. Single-key credential encryption has no automated key-versioned rotation.
   Key recovery and rotation need an operationally tested re-encryption plan.
6. Route-level cross-tenant coverage remains incomplete for all applications.
   Existing helper and auth tests are not a substitute for real database-backed
   tests across every endpoint.
7. GitHub branch protection, required reviews, actual Actions success, staging
   checks, secret rotation from historical commits, backups/restore, monitoring,
   incident response, and retention policies remain owner/operator actions.

See [authentication](./docs/AUTHENTICATION.md),
[CI](./docs/CI.md), [migration runbook](./docs/MIGRATIONS.md), and
[security/deployment checks](./docs/SECURITY_DEPLOYMENT.md) for operational
details. Do not use a successful local build or test run as a production
readiness claim.
