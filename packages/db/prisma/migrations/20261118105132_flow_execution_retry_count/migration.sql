-- Add retryCount field to FlowExecution for retry logic on failed executions

ALTER TABLE "FlowExecution" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "FlowExecution_status_retryCount_idx" ON "FlowExecution" ("status", "retryCount");
