import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ImapFlow } from "imapflow";
import { MailboxStatus, MailboxType } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { createSessionToken, encryptCredential, hashSessionToken } from "./webmail-crypto";

const sessionTtlMs = 12 * 60 * 60 * 1000;

type LoginInput = {
  email?: string;
  password?: string;
  portalSlug?: string;
};

@Injectable()
export class WebmailAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(input: LoginInput) {
    const email = normalizeEmail(input.email);
    const password = requirePassword(input.password);
    const portalSlug = normalizeSlug(input.portalSlug);
    const organization = await this.prisma.organization.findUnique({ where: { slug: portalSlug } });
    if (!organization) throw invalidCredentials();

    const mailbox = await this.prisma.mailbox.findFirst({
      where: {
        address: email,
        organizationId: organization.id,
        status: MailboxStatus.ACTIVE,
        type: MailboxType.BUSINESS,
      },
    });
    if (!mailbox) throw invalidCredentials();

    await authenticateImap(email, password).catch((error: unknown) => {
      const safeError = error as {
        code?: string;
        responseCode?: string;
        message?: string;
      };

      console.error("Webmail IMAP login failed", {
        code: safeError.code,
        responseCode: safeError.responseCode,
        message: safeError.message,
      });

      throw invalidCredentials();
    });

    const webmailSessionToken = createSessionToken();
    const now = new Date();
    await this.prisma.webmailSession.create({
      data: {
        mailboxId: mailbox.id,
        organizationId: organization.id,
        portalSlug: organization.slug,
        tokenHash: hashSessionToken(webmailSessionToken),
        encryptedCredential: encryptCredential(password),
        expiresAt: new Date(now.getTime() + sessionTtlMs),
        lastActivityAt: now,
      },
    });

    return {
      webmailSessionToken,
      redirectTo: "/employee",
      mailbox: { address: mailbox.address, displayName: mailbox.displayName },
      portal: { slug: organization.slug, displayName: organization.name },
    };
  }
}

function normalizeEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw invalidCredentials();
  return email;
}

function requirePassword(value: string | undefined) {
  if (!value) throw invalidCredentials();
  return value;
}

function normalizeSlug(value: string | undefined) {
  const slug = value?.trim().toLowerCase();
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) throw invalidCredentials();
  return slug;
}

function invalidCredentials() {
  return new UnauthorizedException("Invalid email or password.");
}

async function authenticateImap(email: string, password: string) {
  const client = new ImapFlow({
    host: "mail.jposta.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    tls: { servername: "mail.jposta.com", rejectUnauthorized: true },
    logger: false,
    socketTimeout: 12000,
  } as never);
  try {
    await client.connect();

    if (!client.authenticated || !client.usable) {
      throw new Error("IMAP authentication was not completed.");
    }
  } finally {
    if (client.usable) {
      await client.logout().catch(() => {
        client.close();
      });
    } else {
      client.close();
    }
  }
}

