import { Injectable, UnauthorizedException } from "@nestjs/common";
import { MailboxStatus, MailboxType, PortalStatus } from "@prisma/client";
import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "../config/env";
import { normalizePortalSlug } from "../organizations/portal-slug.utils";
import { PrismaService } from "../prisma/prisma.service";
import { ImapAuthenticator } from "./imap-authenticator.service";

const sessionTtlMs = 12 * 60 * 60 * 1000;

type LoginInput = {
  email?: string;
  password?: string;
  portalSlug?: string;
};

@Injectable()
export class WebmailService {
  constructor(
    private readonly imapAuthenticator: ImapAuthenticator,
    private readonly prisma: PrismaService,
  ) {}

  async login(input: LoginInput) {
    const portalSlug = normalizePortalSlug(input.portalSlug);
    const email = normalizeEmail(input.email);
    const password = requirePassword(input.password);
    const organization = await this.prisma.organization.findFirst({
      where: {
        slug: portalSlug,
        mailPortalEnabled: true,
        portalStatus: PortalStatus.ACTIVE,
      },
    });

    if (!organization) {
      throw invalidCredentials();
    }

    const mailbox = await this.prisma.mailbox.findFirst({
      where: {
        address: email,
        organizationId: organization.id,
        status: MailboxStatus.ACTIVE,
        type: MailboxType.BUSINESS,
      },
    });

    if (!mailbox) {
      throw invalidCredentials();
    }

    try {
      await this.imapAuthenticator.authenticate(email, password);
    } catch {
      throw invalidCredentials();
    }

    const webmailSessionToken = randomBytes(32).toString("base64url");
    const now = new Date();
    await this.prisma.webmailSession.create({
      data: {
        mailboxId: mailbox.id,
        organizationId: organization.id,
        portalSlug: organization.slug,
        tokenHash: hashToken(webmailSessionToken),
        encryptedCredential: encryptCredential(password),
        expiresAt: new Date(now.getTime() + sessionTtlMs),
        lastActivityAt: now,
      },
    });

    return {
      webmailSessionToken,
      redirectTo: "/employee",
      mailbox: {
        address: mailbox.address,
        displayName: mailbox.displayName,
      },
      portal: {
        slug: organization.slug,
        displayName: organization.portalDisplayName ?? organization.name,
      },
    };
  }

  async getSession(token: string) {
    const session = await this.prisma.webmailSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        mailbox: true,
        organization: true,
      },
    });
    const now = new Date();

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !session.organization.mailPortalEnabled ||
      session.organization.portalStatus !== PortalStatus.ACTIVE ||
      session.mailbox.status !== MailboxStatus.ACTIVE
    ) {
      throw new UnauthorizedException("Webmail session expired or invalid.");
    }

    await this.prisma.webmailSession.update({
      where: { id: session.id },
      data: { lastActivityAt: now },
    });

    return session;
  }

  async me(token: string) {
    const session = await this.getSession(token);

    return {
      mailbox: {
        address: session.mailbox.address,
        displayName: session.mailbox.displayName,
        status: session.mailbox.status,
      },
      portal: {
        slug: session.organization.slug,
        organizationName: session.organization.name,
        displayName: session.organization.portalDisplayName ?? session.organization.name,
        logoUrl: session.organization.portalLogoUrl,
      },
    };
  }

  meFromSession(session: Awaited<ReturnType<WebmailService["getSession"]>>) {
    return {
      mailbox: {
        address: session.mailbox.address,
        displayName: session.mailbox.displayName,
        status: session.mailbox.status,
      },
      portal: {
        slug: session.organization.slug,
        organizationName: session.organization.name,
        displayName: session.organization.portalDisplayName ?? session.organization.name,
        logoUrl: session.organization.portalLogoUrl,
      },
    };
  }
  async logout(token: string) {
    await this.prisma.webmailSession.updateMany({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { revoked: true };
  }

  async revokeMailboxSessions(mailboxId: string) {
    await this.prisma.webmailSession.updateMany({
      where: {
        mailboxId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}

function normalizeEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw invalidCredentials();
  }

  return email;
}

function requirePassword(value: string | undefined) {
  if (!value) {
    throw invalidCredentials();
  }

  return value;
}

function invalidCredentials() {
  return new UnauthorizedException("Invalid email or password.");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function encryptCredential(password: string) {
  const key = createHash("sha256").update(env.webmailCredentialEncryptionSecret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}
