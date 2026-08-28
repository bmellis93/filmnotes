-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "uploadFingerprint" TEXT,
ADD COLUMN     "uploadId" TEXT,
ADD COLUMN     "uploadPartSize" INTEGER,
ADD COLUMN     "uploadTotalParts" INTEGER;
