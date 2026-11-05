# CircuitSoul digital infrastructure platform

CircuitSoul is a venture-ready digital infrastructure platform for African startups and SMEs.

## Workspace Architecture

The system is configured as a Turborepo monorepo with pnpm workspaces:

```
├── apps/
│   ├── web/        # Main landing, billing, pricing, and middleware
│   ├── shield/     # Security scans posture dashboard and NDPR reports
│   ├── cloudops/   # DevOps costs tracker and Prometheus gauges
│   ├── flow/       # Automation flow builder
│   ├── blog/       # SEO growth writer posting to Ghost
│   └── admin/      # System control room toggling mock flags
├── packages/
│   ├── ui/         # Custom Tailwind/Framer/shadcn design system
│   ├── auth/       # Multi-tenant RBAC permissions middleware
│   ├── db/         # Prisma client models definition
│   ├── ai/         # OpenAI wrappers and custom mocks recommendations
│   ├── security/   # NDPR residency audit engine and HMAC API filters
│   └── api-adapters/ # [NEW] Decoupled adapters translating to OSS engines
├── services/       # [NEW] Git Submodules for n8n, Ghost, Wazuh, Prometheus
└── infra/
    ├── docker/     # Multi-stage production container blueprints
    └── docker-compose.yml # Dev environment isolating OSS engines network
```

## Infrastructure Adapter Pattern

To maintain absolute decoupling, third-party open-source engines are hosted strictly under `/services`.
Direct database or API calls to these engines from application views are forbidden. Instead, applications communicate using `@circuitsoul/api-adapters`.

### Developer Mocks and auth safety

To run the platform locally without provisioning resource-heavy engines (such as a live Wazuh server or n8n database), set the following in your environment:

```env
USE_MOCK_ENGINES=true
ALLOW_DEV_SESSION=true
```

`ALLOW_DEV_SESSION=true` is a local-only developer convenience and must never be enabled in production. In production, the platform requires a valid signed session token and rejects missing or invalid identities without exception.

Authentication separates external identity-provider JWTs from CircuitSoul application sessions. Clerk tokens are accepted only by the callback, where the signature is verified against the rotating `CLERK_JWKS_URL` key set and mandatory expiry, issuer, audience, and verified-email claims are checked. The callback binds the provider subject to an internal user and issues a signed, HttpOnly CircuitSoul session cookie. Protected routes accept only this internal session through the cookie or `Authorization: Bearer`; provider JWTs, `x-circuitsoul-session`, and client-supplied organization headers are not authentication or tenant-selection mechanisms.

Clerk sign-in requires `CLERK_JWKS_URL`, `CLERK_ISSUER_URL`, and `CLERK_AUDIENCE`. Sign-in state is bound to an HttpOnly short-lived cookie and callback token values must be sent in the POST body, not a URL. An existing CircuitSoul account is linked only when the provider supplies a verified matching email; subsequent sign-ins use the durable provider-subject mapping. Organization access and role are checked against the current database membership on protected requests. Session refresh and logout revoke server-side session hashes. Do not enable the development session override outside local development.

When `USE_MOCK_ENGINES=true`, adapters may use limited local demo data. Demo
responses are labeled as such; they are not live measurements or evidence of
service health. Some verification actions, including Shield asset-to-agent
verification, intentionally remain unavailable in mock mode.

Required secret configuration for all non-local environments:

```env
CIRCUITSOUL_AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_PROVIDER="custom" # or "clerk"
CLERK_JWKS_URL="https://your-clerk-domain/.well-known/jwks.json"
CLERK_ISSUER_URL="https://your-clerk-domain"
CLERK_AUDIENCE="circuitsoul-api"
```

## Getting Started

1. **Install dependencies**:
   ```bash
   pnpm install --frozen-lockfile
   ```

2. **Database migration**:
   ```bash
   # Generate Prisma client
   pnpm --filter @circuitsoul/db generate

   # Run production migrations
   pnpm --filter @circuitsoul/db migrate:deploy

   # For an existing database, follow docs/MIGRATIONS.md before deploying.
   ```

3. **Run Dev Environment**:
   ```bash
   pnpm dev
   ```

4. **Run Dockerized Engines**:
   ```bash
   # Copy the committed env example (create your own secrets)
   cp configs/docker-env.example configs/docker-env

   docker-compose -f infra/docker-compose.yml up -d
   ```

## Engineering and security references

- [Authentication and session lifecycle](./docs/AUTHENTICATION.md)
- [CI checks](./docs/CI.md)
- [Database migrations and credential backfill](./docs/MIGRATIONS.md)
- [Security and deployment checklist](./docs/SECURITY_DEPLOYMENT.md)
- [Current audit and remaining risks](./AUDIT_REPORT.md)
