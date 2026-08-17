-- CreateEnum
CREATE TYPE "OrgPlan" AS ENUM ('STARTER', 'STUDIO', 'PRO', 'CUSTOM', 'OWNER');

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "plan" "OrgPlan" NOT NULL DEFAULT 'STARTER',
ADD COLUMN     "storageLimitBytes" BIGINT NOT NULL DEFAULT 107374182400;

-- Seed the app developer's own org to the unlimited OWNER plan (10 TiB).
-- Every other existing org keeps the STARTER default set above.
UPDATE "Org" SET "plan" = 'OWNER', "storageLimitBytes" = 10995116277760
WHERE "id" = 'ESWQ6rS5sjkaAn0Usv5P';
