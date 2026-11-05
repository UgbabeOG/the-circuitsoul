import { prisma } from '../src/index';
import { encryptCloudCredentials } from '../../security/src/encryption';

type LegacyCredentialRow = {
  id: string;
  credentialsJson: string | null;
  credentialsEncrypted: string | null;
  credentialsIv: string | null;
};

async function backfillCloudCredentials() {
  if (!process.env.CREDENTIAL_ENCRYPTION_KEY) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY is required to backfill cloud credentials');
  }
  if (process.env.CREDENTIAL_BACKFILL_CONFIRM !== 'YES') {
    throw new Error('Set CREDENTIAL_BACKFILL_CONFIRM=YES to run the credential backfill');
  }

  const rows = await prisma.$queryRaw<LegacyCredentialRow[]>`
    SELECT "id", "credentialsJson", "credentialsEncrypted", "credentialsIv"
    FROM "CloudEnvironment"
  `;
  let updated = 0;
  for (const row of rows) {
    if (row.credentialsEncrypted && row.credentialsIv) continue;
    if (row.credentialsEncrypted || row.credentialsIv) {
      throw new Error(`Cloud environment ${row.id} has incomplete encrypted credential metadata`);
    }

    const encrypted = encryptCloudCredentials(row.credentialsJson || '');
    await prisma.$executeRaw`
      UPDATE "CloudEnvironment"
      SET "credentialsEncrypted" = ${encrypted.credentialsEncrypted},
          "credentialsIv" = ${encrypted.credentialsIv}
      WHERE "id" = ${row.id}
        AND "credentialsEncrypted" IS NULL
        AND "credentialsIv" IS NULL
    `;
    updated += 1;
  }

  const remaining = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM "CloudEnvironment"
    WHERE "credentialsEncrypted" IS NULL OR "credentialsIv" IS NULL
  `;
  if (remaining[0]?.count !== 0n) {
    throw new Error(`Credential backfill incomplete: ${remaining[0]?.count ?? 'unknown'} rows lack encrypted values`);
  }
  console.log(`Encrypted credentials for ${updated} cloud environment(s). Plaintext remains until the guarded migration is deployed.`);
}

backfillCloudCredentials()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
