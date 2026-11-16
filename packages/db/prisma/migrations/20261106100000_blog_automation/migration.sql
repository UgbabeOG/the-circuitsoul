-- Add CircuitSoul Blog automation models: trend sources, collected trends, article jobs, publishing history.

-- ─── Trend Sources ────────────────────────────────────────────────────────────

CREATE TABLE "trend_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPolledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trend_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trend_sources_provider_url_key" ON "trend_sources" ("provider", "url");

-- ─── Collected Trends ─────────────────────────────────────────────────────────

CREATE TABLE "collected_trends" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "summary" TEXT,
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'Nigeria',
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freshnessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "audienceValueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "combinedScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "externalUrl" TEXT,
    "externalId" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collected_trends_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "collected_trends_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "trend_sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "collected_trends_combinedScore_idx" ON "collected_trends" ("combinedScore" DESC);
CREATE INDEX "collected_trends_collectedAt_idx" ON "collected_trends" ("collectedAt" DESC);
CREATE INDEX "collected_trends_externalId_idx" ON "collected_trends" ("externalId");
CREATE UNIQUE INDEX "collected_trends_sourceId_externalId_key" ON "collected_trends" ("sourceId", "externalId");

-- ─── Article Generation Jobs ──────────────────────────────────────────────────

CREATE TABLE "article_generation_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trendId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "prompt" TEXT,
    "content" TEXT,
    "summary" TEXT,
    "slug" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "heroImageUrl" TEXT,
    "heroImageProvider" TEXT,
    "sourceReferences" JSONB,
    "internalLinkSuggestions" JSONB,
    "wordCount" INTEGER,
    "readingTime" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_generation_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "article_generation_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "article_generation_jobs_trendId_fkey" FOREIGN KEY ("trendId") REFERENCES "collected_trends" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "article_generation_jobs_organizationId_status_idx" ON "article_generation_jobs" ("organizationId", "status");
CREATE INDEX "article_generation_jobs_status_scheduledAt_idx" ON "article_generation_jobs" ("status", "scheduledAt");
CREATE INDEX "article_generation_jobs_slug_idx" ON "article_generation_jobs" ("slug");

-- ─── Publishing Attempts ──────────────────────────────────────────────────────

CREATE TABLE "publishing_attempts" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ghostPostId" TEXT,
    "status" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "errorMessage" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publishing_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "publishing_attempts_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "article_generation_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "publishing_attempts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "publishing_attempts_articleId_createdAt_idx" ON "publishing_attempts" ("articleId", "createdAt" DESC);
CREATE INDEX "publishing_attempts_ghostPostId_idx" ON "publishing_attempts" ("ghostPostId");

-- ─── Blog Automation Settings ─────────────────────────────────────────────────

CREATE TABLE "blog_automation_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "autoDiscoverEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoGenerateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoPublishEnabled" BOOLEAN NOT NULL DEFAULT false,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "dailyGenerationLimit" INTEGER NOT NULL DEFAULT 3,
    "minRelevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "editorialTimezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "generationScheduleHour" INTEGER NOT NULL DEFAULT 9,
    "publishScheduleHour" INTEGER NOT NULL DEFAULT 10,
    "aiProvider" TEXT,
    "imageProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_automation_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "blog_automation_settings_organizationId_key" UNIQUE ("organizationId"),
    CONSTRAINT "blog_automation_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);