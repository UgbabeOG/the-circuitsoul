-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "VulnerabilityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "CloudProvider" AS ENUM ('AWS', 'GCP', 'AZURE');

-- CreateEnum
CREATE TYPE "FlowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIAL', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AiGenerationType" AS ENUM ('BLOG_CONTENT', 'BLOG_HERO', 'SHIELD_REMEDIATION', 'CLOUDOPS_RECOMMENDATION', 'FLOW_TRANSLATION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ALERT', 'NEWSLETTER', 'SYSTEM', 'BILLING');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('DOMAIN', 'IP_ADDRESS', 'WEB_APP', 'DATABASE', 'CLOUD_STORAGE');

-- CreateEnum
CREATE TYPE "CloudEnvironmentStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ATTEMPT', 'SUCCEEDED', 'FAILED', 'DLQ');

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "userId" TEXT,
    "jobId" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'AI_GENERATION',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "storageBytes" INTEGER NOT NULL DEFAULT 0,
    "generationMs" INTEGER NOT NULL DEFAULT 0,
    "jobsExecuted" INTEGER NOT NULL DEFAULT 1,
    "rawPayload" JSONB,
    "aggregated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL DEFAULT 'DOMAIN',
    "target" TEXT NOT NULL,
    "agentId" TEXT,
    "isAuthorized" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShieldAssessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER NOT NULL,
    "overallRisk" TEXT NOT NULL,
    "isVerifiedTechnical" BOOLEAN NOT NULL DEFAULT false,
    "reportPdfUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShieldAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NDPRAssessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "compliant" BOOLEAN NOT NULL DEFAULT false,
    "answersJson" TEXT NOT NULL,
    "reportPdfUrl" TEXT,
    "remediationsJson" TEXT,
    "conductedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NDPRAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityConsultingRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "scope" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityConsultingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShieldVulnerability" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "description" TEXT NOT NULL,
    "remediation" TEXT NOT NULL,
    "status" "VulnerabilityStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShieldVulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudEnvironment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "credentialsJson" TEXT NOT NULL DEFAULT '',
    "credentialsEncrypted" TEXT,
    "credentialsIv" TEXT,
    "status" "CloudEnvironmentStatus" NOT NULL DEFAULT 'CONNECTED',
    "score" INTEGER NOT NULL DEFAULT 0,
    "costMonthly" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CloudEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudMetric" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "cpuUtilization" DOUBLE PRECISION NOT NULL,
    "memoryUtilization" DOUBLE PRECISION NOT NULL,
    "costDaily" DECIMAL(12,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloudMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowWorkflow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "FlowStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerType" TEXT NOT NULL,
    "definitionJson" TEXT NOT NULL,
    "externalWorkflowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FlowWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "logsJson" TEXT,
    CONSTRAINT "FlowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "status" "BlogStatus" NOT NULL DEFAULT 'DRAFT',
    "seoKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "heroImageUrl" TEXT,
    "trendSource" TEXT,
    "externalGhostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGeneration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "type" "AiGenerationType" NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "JobStatus" NOT NULL,
    "error" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RevokedSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateIndex
CREATE INDEX "Subscription_organizationId_idx" ON "Subscription"("organizationId");

-- CreateIndex
CREATE INDEX "UsageRecord_subscriptionId_idx" ON "UsageRecord"("subscriptionId");

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_aggregated_createdAt_idx" ON "UsageEvent"("organizationId", "aggregated", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_subscriptionId_aggregated_idx" ON "UsageEvent"("subscriptionId", "aggregated");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Asset_organizationId_target_idx" ON "Asset"("organizationId", "target");

-- CreateIndex
CREATE INDEX "ShieldAssessment_organizationId_createdAt_idx" ON "ShieldAssessment"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "NDPRAssessment_organizationId_createdAt_idx" ON "NDPRAssessment"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityConsultingRequest_organizationId_status_idx" ON "SecurityConsultingRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CloudEnvironment_organizationId_idx" ON "CloudEnvironment"("organizationId");

-- CreateIndex
CREATE INDEX "CloudMetric_environmentId_idx" ON "CloudMetric"("environmentId");

-- CreateIndex
CREATE INDEX "FlowWorkflow_organizationId_status_idx" ON "FlowWorkflow"("organizationId", "status");

-- CreateIndex
CREATE INDEX "FlowExecution_workflowId_startedAt_idx" ON "FlowExecution"("workflowId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_organizationId_status_idx" ON "BlogPost"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiGeneration_idempotencyKey_key" ON "AiGeneration"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RevokedSession_tokenHash_key" ON "RevokedSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RevokedSession_userId_idx" ON "RevokedSession"("userId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShieldAssessment" ADD CONSTRAINT "ShieldAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShieldAssessment" ADD CONSTRAINT "ShieldAssessment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShieldAssessment" ADD CONSTRAINT "ShieldAssessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NDPRAssessment" ADD CONSTRAINT "NDPRAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityConsultingRequest" ADD CONSTRAINT "SecurityConsultingRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShieldVulnerability" ADD CONSTRAINT "ShieldVulnerability_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ShieldAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudEnvironment" ADD CONSTRAINT "CloudEnvironment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudMetric" ADD CONSTRAINT "CloudMetric_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "CloudEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowWorkflow" ADD CONSTRAINT "FlowWorkflow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowExecution" ADD CONSTRAINT "FlowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "FlowWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
