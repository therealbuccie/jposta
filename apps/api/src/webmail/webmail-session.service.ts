import { Injectable, UnauthorizedException } from "@nestjs/common";
import { MailboxStatus, PortalStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { decryptCredential, hashSessionToken } from "./webmail-crypto";

@Injectable()
export class WebmailSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getSession(token: string) {
    const session = await this.prisma.webmailSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
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

    return {
      ...session,
      credential: decryptCredential(session.encryptedCredential),
    };
  }

  async logout(token: string) {
    await this.prisma.webmailSession.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }
}
