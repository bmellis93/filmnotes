-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('VIEWER', 'UPLOADER', 'CONTRIBUTOR', 'ADMIN');

-- AlterTable: cast existing free-text role values into the new enum.
-- Only 'ADMIN' has ever been written by this app; anything else (including
-- the old, never-actually-used 'USER' value) maps to the safe default.
ALTER TABLE "OrgMember"
  ALTER COLUMN "role" TYPE "OrgRole" USING (
    CASE "role"
      WHEN 'ADMIN' THEN 'ADMIN'
      WHEN 'UPLOADER' THEN 'UPLOADER'
      WHEN 'CONTRIBUTOR' THEN 'CONTRIBUTOR'
      WHEN 'VIEWER' THEN 'VIEWER'
      ELSE 'VIEWER'
    END
  )::"OrgRole";
