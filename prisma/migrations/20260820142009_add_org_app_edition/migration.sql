-- CreateEnum
CREATE TYPE "AppEdition" AS ENUM ('PRIVATE', 'PAID');

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "appEdition" "AppEdition" NOT NULL DEFAULT 'PRIVATE';
