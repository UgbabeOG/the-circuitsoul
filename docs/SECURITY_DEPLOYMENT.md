# Security and deployment checklist

This repository is a development foundation, not a production-readiness
certification. Do not deploy with customer data until the staging gates below
are completed and reviewed.

## Secrets and network

- Generate unique `CIRCUITSOUL_AUTH_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`,
  database, cache, provider, and engine credentials in a secret manager.
- Never copy real secrets into `.env.example`, Docker examples, client
  variables, build arguments, logs, or source control. Rotate secrets that may
  have appeared in repository history.
- Keep database, Redis, Prometheus, Wazuh, n8n, Ghost, and admin credentials
  server-side. Restrict service networking and ingress to required callers.
- `infra/docker-compose.yml` is for local development, not a production
  deployment or ingress policy.
- Keep `ALLOW_DEV_SESSION=false` and `USE_MOCK_ENGINES=false` in production.
  The adapters must report unavailable data rather than presenting synthetic
  values as live measurements.

## Before staging

- Configure Clerk issuer, JWKS URL, audience, session cookie behavior, and
  state handling against the actual provider deployment.
- Run the clean migration and upgrade/backfill rehearsal on PostgreSQL using
  synthetic data, then repeat against a restorable staging copy.
- Verify encryption key backup/recovery and rehearse a documented re-encryption
  rotation before storing production cloud credentials.
- Verify actual Wazuh agent ownership/identity mapping, Prometheus queries,
  workflow execution authorization, Ghost publishing ownership, and admin
  health checks with live staging services.
- Exercise two separate organizations through every read/write API and verify
  cross-tenant access is rejected.
- Configure GitHub branch protection and required review/status checks; confirm
  the Actions run for the exact candidate commit is fully successful.
- Establish TLS, rate limits, monitoring/alerts, backups and restore drills,
  incident response, data retention, and supported dependency/service versions.

## Honest product status

Shield distinguishes self-reported NDPR assessment from certification; it is
not a certification service. Scanner results and assets require organization
ownership and verified scanner mapping. CloudOps should display unavailable
metrics honestly and must not present estimates as observed cost, uptime, or
health. Review the current route coverage and remaining limitations in
[`AUDIT_REPORT.md`](../AUDIT_REPORT.md) before release.
