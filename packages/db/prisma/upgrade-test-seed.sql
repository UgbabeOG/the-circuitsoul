INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
VALUES ('upgrade-test-org', 'Upgrade test', 'upgrade-test', CURRENT_TIMESTAMP);

INSERT INTO "CloudEnvironment" (
    "id",
    "organizationId",
    "provider",
    "name",
    "credentialsJson",
    "updatedAt"
) VALUES (
    'upgrade-test-environment',
    'upgrade-test-org',
    'AWS',
    'Legacy credentials fixture',
    '{"accessKeyId":"synthetic-key","secretAccessKey":"synthetic-secret"}',
    CURRENT_TIMESTAMP
);
