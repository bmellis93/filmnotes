-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN     "contactName" TEXT;

-- CreateIndex
CREATE INDEX "ShareLink_galleryId_idx" ON "ShareLink"("galleryId");

-- CreateIndex
CREATE INDEX "ShareLink_videoId_idx" ON "ShareLink"("videoId");
