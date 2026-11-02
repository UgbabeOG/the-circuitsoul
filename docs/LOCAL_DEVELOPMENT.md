# CircuitSoul Local Development Guide

**Branch:** `hardening/stage1-security-remediation`

## Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 16+ (local or Docker)
- Redis 7+ (local or Docker)
- Docker (optional, for OSS engines)

## Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/UgbabeOG/the-circuitsoul.git
   cd the-circuitsoul
   git checkout hardening/stage1-security-remediation
   ```

2. **Copy environment files**
   ```bash
   cp .env.example .env
   cp configs/docker-env.example configs/docker-env
   ```

3. **Edit `.env`** with your local values. All `CHANGE_ME_*` values must be replaced:
   - `DATABASE_URL` — PostgreSQL connection string
   - `CIRCUITSOUL_AUTH_SECRET` — Minimum 32 characters, random
   - `GATEWAY_SECRET_KEY` — Random secret
   - `CREDENTIAL_ENCRYPTION_KEY` — Minimum 32 characters, random
   - `OPENAI_API_KEY` — For AI generation (optional; mocks used if absent)
   - `N8N_API_KEY`, `GHOST_ADMIN_API_KEY`, `WAZUH_USER/PASSWORD` — For live OSS engines

4. **Edit `configs/docker-env`** with OSS engine credentials (gitignored, never commit)

## Database Setup

### Option A: Local PostgreSQL

1. Install and start PostgreSQL 16
2. Create the database:
   ```sql
   CREATE DATABASE circuitsoul_db;
   CREATE USER circuitsoul WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE circuitsoul_db TO circuitsoul;
   ```
3. Update `.env` with your `DATABASE_URL`
4. Generate Prisma client:
   ```bash
   pnpm --filter @circuitsoul/db generate
   ```
5. Run migrations:
   ```bash
   pnpm --filter @circuitsoul/db migrate:dev
   ```

### Option B: Docker Compose (OSS engines only)

```bash
docker-compose -f infra/docker-compose.yml up -d postgres redis
```

This starts PostgreSQL and Redis only. The OSS engines (n8n, Ghost, Wazuh, Prometheus) require real credentials and should only be started in a staging environment.

## Application Startup

1. **Install dependencies**
   ```bash
   pnpm install --frozen-lockfile
   ```

2. **Generate Prisma client**
   ```bash
   pnpm --filter @circuitsoul/db generate
   ```

3. **Run the development server**
   ```bash
   pnpm dev
   ```

This starts all Next.js apps via Turborepo. Access them at:
- `http://localhost:3000` — Web (landing)
- `http://localhost:3001` — Shield
- `http://localhost:3002` — CloudOps
- `http://localhost:3003` — Flow
- `http://localhost:3004` — Blog
- `http://localhost:3005` — Admin

*(Ports may vary; check Turbo output for exact URLs)*

## Mock Engine Configuration

**Development:** Set `USE_MOCK_ENGINES=true` in `.env` to use in-memory mock OSS engines without connecting to live services.

**Production:** Must set `USE_MOCK_ENGINES=false`. Live engine failures return errors, never mock data.

## Test Commands

```bash
# Run all tests
pnpm test

# Run auth tests only
pnpm test:auth

# TypeScript check (source files only)
npx tsc --noEmit --strict --skipLibCheck --moduleResolution node --target es2022 --module esnext packages/auth/src/index.ts packages/db/src/tenant.ts packages/security/src/encryption.ts packages/api-adapters/src/index.ts packages/api-adapters/src/n8n.ts packages/api-adapters/src/ghost.ts

# Prisma validation
DATABASE_URL="your_url" pnpm --filter @circuitsoul/db exec prisma validate --schema=packages/db/prisma/schema.prisma

# Lint
pnpm lint

# Build
pnpm build
```

## Shutdown and Troubleshooting

### Shutdown
```bash
# Stop Next.js apps
Ctrl+C

# Stop Docker Compose services
docker-compose -f infra/docker-compose.yml down
```

### Common Issues

| Issue | Solution |
|-------|----------|
| `DATABASE_URL` not found | Set `DATABASE_URL` in `.env` before running Prisma commands |
| Prisma client not generated | Run `pnpm --filter @circuitsoul/db generate` |
| Mock data in production | Ensure `USE_MOCK_ENGINES=false` in production `.env` |
| Auth session rejected | Ensure `CIRCUITSOUL_AUTH_SECRET` is set; check token format |
| Cross-tenant access denied | Verify user has `Membership` record for the target organization |
| Credential encryption fails | Set `CREDENTIAL_ENCRYPTION_KEY` (min 32 chars) |

## Security Notes for Local Development

- `ALLOW_DEV_SESSION=true` enables a hardcoded developer session — **never enable in production**
- `USE_MOCK_ENGINES=true` is safe for local development — **must be `false` in production**
- `configs/docker-env` is gitignored — never commit real values
- All `CHANGE_ME_*` placeholders must be replaced before any non-local deployment
