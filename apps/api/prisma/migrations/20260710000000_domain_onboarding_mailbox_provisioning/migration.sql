-- Extend domain lifecycle status.
ALTER TYPE "DomainStatus" ADD VALUE IF NOT EXISTS 'VERIFYING';
ALTER TYPE "DomainStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';

-- Add mailbox lifecycle status.
CREATE TYPE "MailboxStatus" AS ENUM ('PENDING', 'PROVISIONING', 'ACTIVE', 'FAILED', 'SUSPENDED');

-- Domain onboarding fields.
ALTER TABLE "Domain" ADD COLUMN "verificationToken" TEXT;
UPDATE "Domain" SET "verificationToken" = 'legacy-' || "id" WHERE "verificationToken" IS NULL;
ALTER TABLE "Domain" ALTER COLUMN "verificationToken" SET NOT NULL;
ALTER TABLE "Domain" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Domain" ADD COLUMN "lastCheckedAt" TIMESTAMP(3);
ALTER TABLE "Domain" ADD COLUMN "verificationError" TEXT;
ALTER TABLE "Domain" ADD COLUMN "dkimSelector" TEXT NOT NULL DEFAULT 'mail';
ALTER TABLE "Domain" ADD COLUMN "dkimPublicKey" TEXT;
ALTER TABLE "Domain" ADD COLUMN "dkimPrivateKeyEncrypted" TEXT;
CREATE UNIQUE INDEX "Domain_verificationToken_key" ON "Domain"("verificationToken");

-- Mailbox provisioning fields.
ALTER TABLE "Mailbox" ADD COLUMN "status" "MailboxStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Mailbox" ADD COLUMN "provisioningError" TEXT;
ALTER TABLE "Mailbox" ADD COLUMN "quotaMb" INTEGER NOT NULL DEFAULT 5120;
