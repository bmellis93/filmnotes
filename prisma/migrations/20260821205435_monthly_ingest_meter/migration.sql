-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "ingestPeriodStart" TIMESTAMP(3),
ADD COLUMN     "ingestedBytesThisPeriod" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "ingestCountedAt" TIMESTAMP(3);
