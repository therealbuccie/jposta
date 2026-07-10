import { Injectable, NotFoundException } from "@nestjs/common";
import { DomainStatus } from "@prisma/client";

import type { AuthenticatedUser } from "../auth/auth.types";
import { OrganizationsService } from "../organizations/organizations.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildDomainDnsRecords,
  createVerificationToken,
  normalizeDomainName,
} from "./domain.utils";
import { DomainVerificationService } from "./domain-verification.service";
import { DkimService } from "./dkim.service";

type AddDomainInput = {
  name?: string;
  organizationId?: string;
};

@Injectable()
export class DomainsService {
  constructor(
    private readonly dkimService: DkimService,
    private readonly domainVerificationService: DomainVerificationService,
    private readonly organizationsService: OrganizationsService,
    private readonly prisma: PrismaService,
  ) {}

  async create(input: AddDomainInput, user: AuthenticatedUser) {
    const organization = await this.organizationsService.ensureOwnedByUser(
      input.organizationId,
      user.id,
    );
    const name = normalizeDomainName(input.name);
    const dkim = this.dkimService.generateDomainKey();

    return this.prisma.domain.create({
      data: {
        name,
        organizationId: organization.id,
        verificationToken: createVerificationToken(),
        dkimPublicKey: dkim.dnsPublicKey,
        dkimPrivateKeyEncrypted: dkim.encryptedPrivateKey,
      },
    });
  }

  async list(user: AuthenticatedUser) {
    return this.prisma.domain.findMany({
      where: {
        organization: {
          ownerId: user.id,
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getById(id: string, user: AuthenticatedUser) {
    const domain = await this.prisma.domain.findFirst({
      where: {
        id,
        organization: {
          ownerId: user.id,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!domain) {
      throw new NotFoundException("Domain not found.");
    }

    return domain;
  }

  async getDnsRecords(id: string, user: AuthenticatedUser) {
    const domain = await this.getById(id, user);

    return {
      domain: domain.name,
      records: buildDomainDnsRecords(domain),
    };
  }

  async verify(id: string, user: AuthenticatedUser) {
    const domain = await this.getById(id, user);

    await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: DomainStatus.VERIFYING,
        lastCheckedAt: new Date(),
        verificationError: null,
      },
    });

    const result = await this.domainVerificationService.verify(domain);
    const now = new Date();

    await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: result.verified ? DomainStatus.VERIFIED : DomainStatus.FAILED,
        verifiedAt: result.verified ? now : null,
        lastCheckedAt: now,
        verificationError: result.verified ? null : "One or more DNS records did not match.",
      },
    });

    return result;
  }
}
