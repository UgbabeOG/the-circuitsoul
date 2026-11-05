ALTER TABLE "CloudEnvironment"
    ALTER COLUMN "score" DROP NOT NULL,
    ALTER COLUMN "costMonthly" DROP NOT NULL;

ALTER TABLE "CloudMetric"
    ALTER COLUMN "costDaily" DROP NOT NULL;
