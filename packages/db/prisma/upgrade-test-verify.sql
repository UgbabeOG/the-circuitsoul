DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "CloudEnvironment"
        WHERE "id" = 'upgrade-test-environment'
          AND ("credentialsEncrypted" IS NULL OR "credentialsIv" IS NULL)
    ) THEN
        RAISE EXCEPTION 'upgrade test did not preserve encrypted credentials';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'CloudEnvironment'
          AND column_name = 'credentialsJson'
    ) THEN
        RAISE EXCEPTION 'upgrade test did not retire the plaintext column';
    END IF;
END $$;
