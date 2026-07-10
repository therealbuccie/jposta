CREATE TYPE "PortalStatus" AS ENUM ('ACTIVE', 'DISABLED');

ALTER TABLE "Organization" ADD COLUMN "mailPortalEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "portalDisplayName" TEXT;
ALTER TABLE "Organization" ADD COLUMN "portalLogoUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "portalWelcomeMessage" TEXT;
ALTER TABLE "Organization" ADD COLUMN "portalStatus" "PortalStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "WebmailSession" (
  "id" TEXT NOT NULL,
  "mailboxId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "portalSlug" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "encryptedCredential" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastActivityAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebmailSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebmailSession_tokenHash_key" ON "WebmailSession"("tokenHash");
CREATE INDEX "WebmailSession_mailboxId_idx" ON "WebmailSession"("mailboxId");
CREATE INDEX "WebmailSession_organizationId_idx" ON "WebmailSession"("organizationId");
CREATE INDEX "WebmailSession_portalSlug_idx" ON "WebmailSession"("portalSlug");

ALTER TABLE "WebmailSession" ADD CONSTRAINT "WebmailSession_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebmailSession" ADD CONSTRAINT "WebmailSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
