CREATE TYPE "DnsProvider" AS ENUM ('CLOUDFLARE', 'NAMECHEAP', 'UNKNOWN');
CREATE TYPE "DnsProviderConnectionStatus" AS ENUM ('CONNECTED', 'APPLYING', 'AWAITING_PROPAGATION', 'FAILED');

ALTER TABLE "Domain"
  ADD COLUMN "dnsProvider" "DnsProvider" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "detectedNameservers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "providerDetectedAt" TIMESTAMP(3);

CREATE TABLE "DnsProviderConnection" (
  "id" TEXT NOT NULL,
  "domainId" TEXT NOT NULL,
  "provider" "DnsProvider" NOT NULL,
  "status" "DnsProviderConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
  "encryptedCredentials" TEXT NOT NULL,
  "externalZoneId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "disconnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnsProviderConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DnsProviderConnection_domainId_key" ON "DnsProviderConnection"("domainId");
ALTER TABLE "DnsProviderConnection" ADD CONSTRAINT "DnsProviderConnection_domainId_fkey"
  FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DnsOAuthAttempt" (
  "id" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "domainId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "returnUrl" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnsOAuthAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DnsOAuthAttempt_stateHash_key" ON "DnsOAuthAttempt"("stateHash");
CREATE INDEX "DnsOAuthAttempt_expiresAt_idx" ON "DnsOAuthAttempt"("expiresAt");
ALTER TABLE "DnsOAuthAttempt" ADD CONSTRAINT "DnsOAuthAttempt_domainId_fkey"
  FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DnsOAuthAttempt" ADD CONSTRAINT "DnsOAuthAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
