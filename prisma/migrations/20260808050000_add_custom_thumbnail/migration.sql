-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "thumbnailKey" TEXT,
ADD COLUMN     "thumbnailIsCustom" BOOLEAN NOT NULL DEFAULT false;
