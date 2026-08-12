-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'CHANGES_REQUESTED', 'APPROVED');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "isApprovalNote" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvalUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Video_approvalStatus_idx" ON "Video"("approvalStatus");
