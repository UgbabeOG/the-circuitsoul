# Database migration and cloud credential runbook

All Prisma commands use `packages/db/prisma/schema.prisma`.

## New or clean database

```sh
pnpm --filter @circuitsoul/db generate
pnpm --filter @circuitsoul/db exec prisma validate --schema=prisma/schema.prisma
pnpm --filter @circuitsoul/db migrate:deploy
```

Use `migrate:dev` only for local development when creating a migration. Review
the generated SQL and commit the migration directory with the corresponding
schema change. Do not use `prisma db push` to upgrade a deployed environment.

## Existing database with plaintext cloud credentials

The migration that drops `CloudEnvironment.credentialsJson` fails closed if any
row lacks encrypted values. Backfill must happen before deploying that
migration:

1. Take and verify a restorable database backup. Schedule a maintenance window
   appropriate for the database size and write activity.
2. Provision `CREDENTIAL_ENCRYPTION_KEY` through the secret manager. Back up
   the key independently from the database, restrict access, and record its
   owner and recovery procedure. Never put it in source control or logs.
3. Deploy the application version that writes credentials only through the
   AES-256-GCM encrypted fields. Stop older writers before backfill.
4. Set `CREDENTIAL_BACKFILL_CONFIRM=YES` for this one-off command and run:

   ```sh
   CREDENTIAL_BACKFILL_CONFIRM=YES pnpm credentials:backfill
   ```

   The command requires `DATABASE_URL` and `CREDENTIAL_ENCRYPTION_KEY`. It
   leaves the plaintext column intact and fails on partial/incomplete encrypted
   metadata. Inspect its result and verify encrypted values are present before
   proceeding.
5. Deploy migrations:

   ```sh
   pnpm --filter @circuitsoul/db migrate:deploy
   ```

   The guarded migration verifies every row has both encrypted columns before
   making them non-null and dropping `credentialsJson`.
6. Verify application reads and writes in staging and confirm the plaintext
   column is absent. Retain the verified pre-migration backup according to the
   organization's recovery and retention policy.

Do not run the backfill or destructive migration against production without an
approved change window, tested backup, and explicit operator approval.

## Key rotation and recovery

Credential data is encrypted with AES-256-GCM. The stored base64url blob
contains IV, authentication tag, and ciphertext; the separately stored IV is
checked against the embedded IV. Changing `CREDENTIAL_ENCRYPTION_KEY` without
rewrapping stored values makes existing credentials unreadable.

To rotate, implement and test a controlled re-encryption job that decrypts each
record with the old key and encrypts it with the new key, verifies every row,
and supports rollback from a protected backup. Deploy a version capable of
reading the intended key version before changing the active key. The current
implementation has a single active key and does not provide key-version
selection or automated rotation; do not rotate by simply replacing the
environment variable.

For recovery, restore the matching key from the secret manager's protected
backup and validate decryption against a test record before restoring
application traffic. A database backup without its encryption key cannot
recover credential plaintext.
