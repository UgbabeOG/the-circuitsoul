DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "CloudEnvironment"
        WHERE "credentialsEncrypted" IS NULL OR "credentialsIv" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cloud credential backfill is incomplete; run the credential backfill before deploying this migration';
    END IF;
END $$;

ALTER TABLE "CloudEnvironment"
    ALTER COLUMN "credentialsEncrypted" SET NOT NULL,
    ALTER COLUMN "credentialsIv" SET NOT NULL,
    DROP COLUMN "credentialsJson";
