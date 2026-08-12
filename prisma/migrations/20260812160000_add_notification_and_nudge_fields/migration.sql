-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN     "nudgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "notificationWebhookUrl" TEXT;
