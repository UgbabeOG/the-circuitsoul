CREATE TABLE "ProviderIdentity" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "emailAtLink" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderIdentity_provider_providerSubject_key"
    ON "ProviderIdentity"("provider", "providerSubject");
CREATE INDEX "ProviderIdentity_userId_idx" ON "ProviderIdentity"("userId");
ALTER TABLE "ProviderIdentity"
    ADD CONSTRAINT "ProviderIdentity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
