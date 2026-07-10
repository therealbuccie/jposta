-- User identity lifecycle and roles.
CREATE TYPE "UserStatus" AS ENUM ('PENDING_PROVISIONING', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'FAILED');
CREATE TYPE "UserRole" AS ENUM ('USER', 'WORKSPACE_OWNER', 'WORKSPACE_ADMIN', 'PLATFORM_ADMIN', 'SUPPORT_AGENT');
CREATE TYPE "MailboxType" AS ENUM ('PERSONAL', 'BUSINESS');

ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "primaryEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "recoveryEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "recoveryEmailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'PENDING_PROVISIONING';
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "personalMailboxId" TEXT;

-- Existing-user compatibility backfill.
-- Preserve the current email/password, keep existing users active, and derive a username when safe.
WITH candidates AS (
  SELECT
    "id",
    "email",
    lower(split_part("email", '@', 1)) AS local_part,
    row_number() OVER (PARTITION BY lower(split_part("email", '@', 1)) ORDER BY "createdAt", "id") AS duplicate_rank
  FROM "User"
), normalized AS (
  SELECT
    "id",
    "email",
    CASE
      WHEN local_part ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$'
        AND local_part !~ '\.\.'
        AND local_part NOT IN (
          'admin', 'administrator', 'support', 'billing', 'security', 'mail', 'postmaster',
          'abuse', 'root', 'api', 'help', 'sales', 'info', 'contact', 'webmaster', 'system',
          'noreply', 'no-reply', 'mailer-daemon', 'hostmaster'
        )
        AND duplicate_rank = 1
      THEN local_part
      ELSE 'user-' || substring("id" from 1 for 12)
    END AS backfilled_username
  FROM candidates
)
UPDATE "User"
SET
  "username" = normalized.backfilled_username,
  "primaryEmail" = normalized."email",
  "status" = 'ACTIVE',
  "role" = 'USER'
FROM normalized
WHERE "User"."id" = normalized."id";

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "primaryEmail" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_primaryEmail_key" ON "User"("primaryEmail");
CREATE UNIQUE INDEX "User_personalMailboxId_key" ON "User"("personalMailboxId");

ALTER TABLE "Mailbox" ADD COLUMN "type" "MailboxType" NOT NULL DEFAULT 'BUSINESS';
ALTER TABLE "Mailbox" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "Mailbox" ALTER COLUMN "domainId" DROP NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_personalMailboxId_fkey"
FOREIGN KEY ("personalMailboxId")
REFERENCES "Mailbox"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
-- Keep business mailbox invariants at the database level while allowing personal @jposta.com mailboxes.
ALTER TABLE "Mailbox"
ADD CONSTRAINT "Mailbox_business_requires_org_domain"
CHECK (
  (
    "type" = 'BUSINESS'
    AND "organizationId" IS NOT NULL
    AND "domainId" IS NOT NULL
  )
  OR
  (
    "type" = 'PERSONAL'
    AND "organizationId" IS NULL
    AND "domainId" IS NULL
  )
);
