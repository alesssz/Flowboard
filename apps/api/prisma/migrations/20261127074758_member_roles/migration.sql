-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'editor', 'viewer');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "role" "MemberRole" NOT NULL DEFAULT 'editor';

-- Added by hand: until now every member with an account could do everything on their board, so each
-- becomes an owner, and no board is left without one.
UPDATE "Member" SET "role" = 'owner' WHERE "userId" IS NOT NULL;
