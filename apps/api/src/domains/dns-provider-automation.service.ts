import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DnsProvider, DnsProviderConnectionStatus, DomainStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";

import type { AuthenticatedUser } from "../auth/auth.types";
import { env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { CloudflareDnsService } from "./cloudflare-dns.service";
import { buildDnsChangePlan, fingerprint } from "./dns-change-plan";
import { DnsProviderDetectionService } from "./dns-provider-detection.service";
import { DomainVerificationService } from "./domain-verification.service";
import { NamecheapDnsService, type NamecheapCredentials } from "./namecheap-dns.service";
import {
  decryptProviderCredentials,
  encryptProviderCredentials,
  hashOAuthState,
} from "./provider-crypto";

type CloudflareCredentials = { accessToken: string; refreshToken?: string };

@Injectable()
export class DnsProviderAutomationService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly cloudflare: CloudflareDnsService,
    private readonly detection: DnsProviderDetectionService,
    private readonly namecheap: NamecheapDnsService,
    private readonly prisma: PrismaService,
    private readonly verification: DomainVerificationService,
  ) {}

  onModuleInit() {
    this.cleanupTimer = setInterval(() => void this.purgeExpiredConnections(), 60 * 60_000);
    this.cleanupTimer.unref();
    void this.purgeExpiredConnections();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async detectAndPersist(domain: { id: string; name: string }) {
    const detected = await this.detection.detect(domain.name);
    return this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        dnsProvider: detected.provider,
        detectedNameservers: detected.nameservers,
        providerDetectedAt: detected.detectedAt,
      },
    });
  }

  async redetect(id: string, user: AuthenticatedUser) {
    const domain = await this.ownedDomain(id, user.id);
    const updated = await this.detectAndPersist(domain);
    return this.publicDomain(updated);
  }

  async beginCloudflare(id: string, user: AuthenticatedUser) {
    const domain = await this.ownedDomain(id, user.id);
    if (domain.dnsProvider !== DnsProvider.CLOUDFLARE) {
      throw new BadRequestException("This domain is not currently delegated to Cloudflare.");
    }
    if (!env.cloudflareOAuthClientId || !env.cloudflareOAuthClientSecret) {
      throw new BadRequestException("Cloudflare OAuth is not configured for JPosta.");
    }
    const state = randomBytes(32).toString("base64url");
    const returnUrl = `${env.webOrigin.replace(/\/$/, "")}/domains?provider=cloudflare&domainId=${encodeURIComponent(domain.id)}`;
    await this.prisma.dnsOAuthAttempt.create({
      data: {
        stateHash: hashOAuthState(state),
        domainId: domain.id,
        userId: user.id,
        returnUrl,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    const url = new URL("https://dash.cloudflare.com/oauth2/auth");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", env.cloudflareOAuthClientId);
    url.searchParams.set("redirect_uri", env.cloudflareOAuthRedirectUri);
    url.searchParams.set("scope", env.cloudflareOAuthScopes);
    url.searchParams.set("state", state);
    return { authorizationUrl: url.toString() };
  }

  async completeCloudflare(input: {
    code?: string | undefined;
    error?: string | undefined;
    state?: string | undefined;
  }) {
    if (!input.state) return `${env.webOrigin}/domains?providerError=missing_state`;
    const attempt = await this.prisma.dnsOAuthAttempt.findUnique({
      where: { stateHash: hashOAuthState(input.state) },
      include: { domain: true },
    });
    if (!attempt || attempt.usedAt || attempt.expiresAt <= new Date()) {
      return `${env.webOrigin}/domains?providerError=invalid_state`;
    }
    const claimed = await this.prisma.dnsOAuthAttempt.updateMany({
      where: { id: attempt.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return `${env.webOrigin}/domains?providerError=invalid_state`;
    if (input.error || !input.code) return `${attempt.returnUrl}&providerError=access_denied`;
    if (!env.cloudflareOAuthClientId || !env.cloudflareOAuthClientSecret) {
      return `${attempt.returnUrl}&providerError=not_configured`;
    }

    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        client_id: env.cloudflareOAuthClientId,
        client_secret: env.cloudflareOAuthClientSecret,
        redirect_uri: env.cloudflareOAuthRedirectUri,
      });
      const response = await fetch("https://dash.cloudflare.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const token = (await response.json().catch(() => null)) as {
        access_token?: string;
        expires_in?: number;
        refresh_token?: string;
      } | null;
      if (!response.ok || !token?.access_token)
        throw new BadGatewayException("Cloudflare token exchange failed.");
      const zone = await this.cloudflare.findZone(token.access_token, attempt.domain.name);
      if (!zone)
        throw new BadRequestException(
          "The authorized Cloudflare accounts do not contain this zone.",
        );
      await this.prisma.dnsProviderConnection.upsert({
        where: { domainId: attempt.domainId },
        create: {
          domainId: attempt.domainId,
          provider: DnsProvider.CLOUDFLARE,
          encryptedCredentials: encryptProviderCredentials({
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
          }),
          externalZoneId: zone.id,
          expiresAt: new Date(Date.now() + Math.min(token.expires_in ?? 86_400, 86_400) * 1000),
        },
        update: {
          status: DnsProviderConnectionStatus.CONNECTED,
          encryptedCredentials: encryptProviderCredentials({
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
          }),
          externalZoneId: zone.id,
          expiresAt: new Date(Date.now() + Math.min(token.expires_in ?? 86_400, 86_400) * 1000),
          disconnectedAt: null,
        },
      });
      return `${attempt.returnUrl}&providerConnected=1`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloudflare connection failed.";
      return `${attempt.returnUrl}&providerError=${encodeURIComponent(message)}`;
    }
  }

  async connectNamecheap(
    id: string,
    input: { apiKey?: string; apiUser?: string },
    user: AuthenticatedUser,
  ) {
    const domain = await this.ownedDomain(id, user.id);
    if (domain.dnsProvider !== DnsProvider.NAMECHEAP) {
      throw new BadRequestException("This domain is not currently delegated to Namecheap.");
    }
    const apiUser = input.apiUser?.trim();
    const apiKey = input.apiKey?.trim();
    if (!apiUser || !apiKey)
      throw new BadRequestException("Namecheap API username and key are required.");
    const credentials = { apiUser, apiKey };
    await this.namecheap.listRecords(domain.name, credentials);
    await this.prisma.dnsProviderConnection.upsert({
      where: { domainId: domain.id },
      create: {
        domainId: domain.id,
        provider: DnsProvider.NAMECHEAP,
        encryptedCredentials: encryptProviderCredentials(credentials),
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
      update: {
        provider: DnsProvider.NAMECHEAP,
        status: DnsProviderConnectionStatus.CONNECTED,
        encryptedCredentials: encryptProviderCredentials(credentials),
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        disconnectedAt: null,
      },
    });
    return this.connectionStatus(id, user);
  }

  async connectionStatus(id: string, user: AuthenticatedUser) {
    await this.ownedDomain(id, user.id);
    const connection = await this.prisma.dnsProviderConnection.findUnique({
      where: { domainId: id },
    });
    if (connection && connection.expiresAt <= new Date()) {
      await this.disconnectInternal(connection);
      return {
        connected: false,
        provider: null,
        status: null,
        expiresAt: null,
        namecheap: this.namecheap.configuration(),
      };
    }
    return {
      connected: Boolean(
        connection && !connection.disconnectedAt && connection.expiresAt > new Date(),
      ),
      provider: connection?.provider ?? null,
      status: connection?.status ?? null,
      expiresAt: connection?.expiresAt ?? null,
      namecheap: this.namecheap.configuration(),
    };
  }

  async preview(id: string, user: AuthenticatedUser) {
    const domain = await this.ownedDomain(id, user.id);
    const { connection, records } = await this.connectionAndRecords(domain);
    return { provider: connection.provider, ...buildDnsChangePlan(domain, records) };
  }

  async apply(
    id: string,
    input: { confirmConflicts?: boolean; sourceFingerprint?: string },
    user: AuthenticatedUser,
  ) {
    const domain = await this.ownedDomain(id, user.id);
    const { connection, credentials, records } = await this.connectionAndRecords(domain);
    const plan = buildDnsChangePlan(domain, records);
    if (!input.sourceFingerprint || input.sourceFingerprint !== fingerprint(records)) {
      throw new ConflictException("DNS changed after the preview. Review the latest change plan.");
    }
    if (plan.hasConflicts && input.confirmConflicts !== true) {
      throw new BadRequestException("Confirm the DNS conflicts before applying changes.");
    }
    await this.prisma.dnsProviderConnection.update({
      where: { id: connection.id },
      data: { status: DnsProviderConnectionStatus.APPLYING },
    });
    try {
      if (connection.provider === DnsProvider.CLOUDFLARE) {
        await this.cloudflare.applyPlan(
          connection,
          credentials as CloudflareCredentials,
          plan.items,
        );
      } else {
        await this.namecheap.applyPlan(
          domain.name,
          credentials as NamecheapCredentials,
          records,
          plan.items,
        );
      }
      await this.prisma.dnsProviderConnection.update({
        where: { id: connection.id },
        data: { status: DnsProviderConnectionStatus.AWAITING_PROPAGATION },
      });
      const verification = await this.verifyDomain(domain);
      if (verification.verified) await this.disconnectInternal(connection);
      return { applied: true, verification };
    } catch (error) {
      await this.prisma.dnsProviderConnection.update({
        where: { id: connection.id },
        data: { status: DnsProviderConnectionStatus.FAILED },
      });
      throw error;
    }
  }

  async disconnect(id: string, user: AuthenticatedUser) {
    await this.ownedDomain(id, user.id);
    const connection = await this.prisma.dnsProviderConnection.findUnique({
      where: { domainId: id },
    });
    if (connection) await this.disconnectInternal(connection);
    return { disconnected: true };
  }

  async disconnectAfterVerified(domainId: string) {
    const connection = await this.prisma.dnsProviderConnection.findUnique({ where: { domainId } });
    if (connection) await this.disconnectInternal(connection);
  }

  private async connectionAndRecords(
    domain: Awaited<ReturnType<DnsProviderAutomationService["ownedDomain"]>>,
  ) {
    const connection = await this.prisma.dnsProviderConnection.findUnique({
      where: { domainId: domain.id },
    });
    if (!connection || connection.disconnectedAt || connection.expiresAt <= new Date()) {
      if (connection) await this.disconnectInternal(connection);
      throw new BadRequestException("Connect the detected DNS provider before continuing.");
    }
    const credentials = decryptProviderCredentials<CloudflareCredentials | NamecheapCredentials>(
      connection.encryptedCredentials,
    );
    const records =
      connection.provider === DnsProvider.CLOUDFLARE
        ? await this.cloudflare.listRecords(connection, credentials as CloudflareCredentials)
        : await this.namecheap.listRecords(domain.name, credentials as NamecheapCredentials);
    return { connection, credentials, records };
  }

  private async disconnectInternal(connection: {
    encryptedCredentials: string;
    id: string;
    provider: DnsProvider;
  }) {
    if (connection.provider === DnsProvider.CLOUDFLARE) {
      const credentials = decryptProviderCredentials<CloudflareCredentials>(
        connection.encryptedCredentials,
      );
      await this.cloudflare.revoke(credentials.accessToken);
    }
    await this.prisma.dnsProviderConnection.delete({ where: { id: connection.id } });
  }

  private async verifyDomain(
    domain: Awaited<ReturnType<DnsProviderAutomationService["ownedDomain"]>>,
  ) {
    const result = await this.verification.verify(domain);
    const now = new Date();
    await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: result.verified ? DomainStatus.VERIFIED : DomainStatus.VERIFYING,
        verifiedAt: result.verified ? now : null,
        lastCheckedAt: now,
        verificationError: result.verified
          ? null
          : "DNS changes were applied and are awaiting propagation.",
      },
    });
    return result;
  }

  private async ownedDomain(id: string, userId: string) {
    const domain = await this.prisma.domain.findFirst({
      where: { id, organization: { ownerId: userId } },
    });
    if (!domain) throw new NotFoundException("Domain not found.");
    return domain;
  }

  private async purgeExpiredConnections() {
    const now = new Date();
    const connections = await this.prisma.dnsProviderConnection.findMany({
      where: { expiresAt: { lte: now } },
    });
    await Promise.allSettled(connections.map((connection) => this.disconnectInternal(connection)));
    await this.prisma.dnsOAuthAttempt.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] },
    });
  }

  private publicDomain<T extends { dnsProvider: DnsProvider; detectedNameservers: string[] }>(
    domain: T,
  ) {
    return { ...domain, automationAvailable: domain.dnsProvider !== DnsProvider.UNKNOWN };
  }
}
