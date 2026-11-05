# Security remediation status

This document supersedes the older point-in-time remediation notes. The
authoritative current status and known limitations are in
[`AUDIT_REPORT.md`](../AUDIT_REPORT.md).

## Controls in the current worktree

- Provider JWTs are verified independently from internal HMAC sessions.
- Authenticated organization routes reload membership and role from PostgreSQL;
  client-supplied organization headers are not trusted.
- Session refresh and logout revoke server-side token hashes.
- Platform-wide Admin routes use a separate server-side email allowlist.
- Cloud credentials are encrypted with AES-256-GCM and tag integrity is
  verified; the upgrade path backfills encrypted values before retiring the
  plaintext column.
- CloudOps credentials remain server-side, and unavailable metrics are not
  represented as real measurements.
- Shield scans require organization-owned, explicitly authorized assets and
  verified scanner mapping. Reports are organization-scoped and clearly
  distinguish assessment from certification.
- Flow execution requires organization ownership and an active workflow.
- Blog content is sanitized before storage/publication and publisher ownership
  is checked.

## Do not infer release readiness

The changes are not production-verified until the branch is reviewed and pushed,
the exact GitHub Actions run succeeds, migrations/backfill are rehearsed on a
restorable staging database, and live service behavior is verified.

Important open items include full Clerk browser flow and OIDC nonce handling,
database-backed route-level isolation tests, live service health checks, actual
Wazuh/Prometheus/n8n/Ghost integration validation, credential key rotation,
branch protections, and operational recovery controls. See
[`AUTHENTICATION.md`](./AUTHENTICATION.md),
[`MIGRATIONS.md`](./MIGRATIONS.md), and
[`SECURITY_DEPLOYMENT.md`](./SECURITY_DEPLOYMENT.md).
