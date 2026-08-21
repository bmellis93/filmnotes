-- AlterEnum
ALTER TYPE "OrgRole" ADD VALUE 'NONE';

-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN     "revokedAt" TIMESTAMP(3);
