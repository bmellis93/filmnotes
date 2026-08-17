-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "overageBilledBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "overageBillingPeriodStart" TIMESTAMP(3);
