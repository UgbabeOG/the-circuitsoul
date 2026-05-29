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

### Developer Mocks

To run the platform locally without provisioning resource-heavy engines (such as a live Wazuh server or n8n database), set the following in your environment:

```env
USE_MOCK_ENGINES=true
```

When set to `true`, the adapters fall back to local high-fidelity mock engines providing realistic telemetry, threat lists, and automation executions.

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
