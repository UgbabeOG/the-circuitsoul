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

Authentication is provider-aware. The default `AUTH_PROVIDER=custom` uses CircuitSoul’s signed HMAC session tokens. To integrate with an external identity provider, set `AUTH_PROVIDER=clerk` and provide `CLERK_PUBLIC_KEY` for JWT verification. The app will still reject missing or invalid sessions unless a valid trusted provider token is present.

For multi-organization users, the active tenant may be explicitly selected with the `x-circuitsoul-org-id` request header. The app accepts the override at parse time, but every organization-scoped route still verifies the selected org against the user’s real `Membership` records before granting access. This prevents trusted tokens from being used to cross into unapproved organizations.

When `USE_MOCK_ENGINES=true`, the adapters fall back to local high-fidelity mock engines providing realistic telemetry, threat lists, and automation executions.

Required secret configuration for all non-local environments:

```env
CIRCUITSOUL_AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_PROVIDER="custom" # or "clerk"
CLERK_PUBLIC_KEY=""
```

## Getting Started

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Database migration**:
   ```bash
   npx prisma db push --schema=packages/db/prisma/schema.prisma
   ```

3. **Run Dev Environment**:
   ```bash
   pnpm dev
   ```

4. **Run Dockerized Engines**:
   ```bash
   docker-compose -f infra/docker-compose.yml up -d
   ```
