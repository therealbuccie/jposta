import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/auth.types";
import { OrganizationsService } from "../organizations/organizations.service";
import { PrismaService } from "../prisma/prisma.service";

type CreateMailboxInput = {
  displayName?: string;
  domainId?: string;
  localPart?: string;
  organizationId?: string;
  userId?: string;
};

@Injectable()
export class MailboxesService {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly prisma: PrismaService,
  ) {}

  async create(input: CreateMailboxInput, user: AuthenticatedUser) {
    const organization = await this.organizationsService.ensureOwnedByUser(
      input.organizationId,
      user.id,
    );
    const domainId = requireText(input.domainId, "domainId");
    const domain = await this.prisma.domain.findFirst({
      where: {
        id: domainId,
        organizationId: organization.id,
      },
    });

    if (!domain) {
      throw new NotFoundException("Domain not found for this organization.");
    }

    const localPart = normalizeLocalPart(input.localPart);
    const displayName = input.displayName?.trim() || localPart;

    return this.prisma.mailbox.create({
      data: {
        address: `${localPart}@${domain.name}`,
        displayName,
        organizationId: organization.id,
        domainId: domain.id,
        userId: input.userId || user.id,
      },
      include: {
        domain: true,
        organization: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }
}

function requireText(value: string | undefined, field: string) {
  const text = value?.trim();

  if (!text) {
    throw new BadRequestException(`${field} is required.`);
  }

  return text;
}

function normalizeLocalPart(value: string | undefined) {
  const localPart = value?.trim().toLowerCase();

  if (!localPart || !/^[a-z0-9._-]+$/.test(localPart)) {
    throw new BadRequestException("A valid mailbox local part is required.");
  }

  return localPart;
}
