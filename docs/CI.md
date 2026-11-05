# CI checks

GitHub Actions runs `.github/workflows/ci.yml` for pushes to maintained
branches and pull requests targeting the configured release branches.
Use pnpm `9.15.0` and Node.js 20 to match CI.

The workflow performs:

1. Frozen dependency installation and Prisma client generation.
2. Workspace TypeScript checks and ESLint.
3. Secret scanning with the immutable TruffleHog action revision.
4. Prisma validation, clean migration deployment, unit/API tests, and migration
   status verification against PostgreSQL and Redis services.
5. A full Turborepo build.
6. `pnpm audit --audit-level moderate`.

Run the local equivalents from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @circuitsoul/db generate
pnpm typecheck
pnpm lint
pnpm test
DATABASE_URL='postgresql://user:password@localhost:5432/circuitsoul' \
  pnpm --filter @circuitsoul/db exec prisma validate --schema=prisma/schema.prisma
pnpm --filter @circuitsoul/db exec prisma migrate deploy --schema=prisma/schema.prisma
pnpm build
pnpm audit --audit-level moderate
```

The hosted workflow is the source of truth for CI status. Passing local commands
does not establish that GitHub Actions passed; report a successful run only
after the run for the exact pushed commit has completed successfully.

The migration-upgrade job exercises the legacy schema and credential-backfill
gate. It uses synthetic test data only. It does not replace a staging rehearsal
against a restorable copy of an existing customer database.
