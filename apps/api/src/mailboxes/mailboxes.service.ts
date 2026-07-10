import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DomainStatus, MailboxStatus, MailboxType } from "@prisma/client";

import type { AuthenticatedUser } from "../auth/auth.types";
import { MailProvisioningService } from "../mail-provisioning/mail-provisioning.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeMailboxLocalPart } from "./mailbox.utils";

type CreateMailboxInput = {
  displayName?: string;
  domainId?: string;
  localPart?: string;
  organizationId?: string;
  password?: string;
  quotaMb?: number;
  userId?: string;
};

type PasswordInput = {
  password?: string;
};

@Injectable()
export class MailboxesService {
  constructor(
    private readonly mailProvisioningService: MailProvisioningService,
    private readonly organizationsService: OrganizationsService,
    private readonly prisma: PrismaService,
  ) {}

  async list(user: AuthenticatedUser) {
    return this.prisma.mailbox.findMany({
      where: {
        OR: [
          {
            userId: user.id,
            type: MailboxType.PERSONAL,
          },
          {
            organization: {
              ownerId: user.id,
            },
            type: MailboxType.BUSINESS,
          },
        ],
      },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
      include: mailboxInclude,
    });
  }

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

    if (domain.status !== DomainStatus.VERIFIED && domain.status !== DomainStatus.ACTIVE) {
      throw new BadRequestException("Domain must be verified before creating mailboxes.");
    }

    const localPart = normalizeMailboxLocalPart(input.localPart);
    const password = requirePassword(input.password);
    const displayName = input.displayName?.trim() || localPart;
    const quotaMb = normalizeQuota(input.quotaMb);
    const address = `${localPart}@${domain.name}`;
    const existingMailbox = await this.prisma.mailbox.findUnique({ where: { address } });

    if (existingMailbox) {
      throw new ConflictException("Mailbox address already exists.");
    }

    const mailbox = await this.prisma.mailbox.create({
      data: {
        address,
        displayName,
        type: MailboxType.BUSINESS,
        status: MailboxStatus.PROVISIONING,
        quotaMb,
        organizationId: organization.id,
        domainId: domain.id,
        userId: input.userId || user.id,
      },
    });

    try {
      await this.mailProvisioningService.createMailbox({ address, password, quotaMb });
      return this.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: {
          status: MailboxStatus.ACTIVE,
          provisioningError: null,
        },
        include: mailboxInclude,
      });
    } catch (error) {
      await this.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: {
          status: MailboxStatus.FAILED,
          provisioningError: error instanceof Error ? error.message : "Provisioning failed.",
        },
      });
      throw error;
    }
  }

  async updatePassword(id: string, input: PasswordInput, user: AuthenticatedUser) {
    const mailbox = await this.getOwnedMailbox(id, user.id);
    const password = requirePassword(input.password);

    await this.mailProvisioningService.updatePassword(mailbox.address, password);

    return this.prisma.mailbox.update({
      where: { id: mailbox.id },
      data: {
        provisioningError: null,
      },
      include: mailboxInclude,
    });
  }

  async suspend(id: string, user: AuthenticatedUser) {
    const mailbox = await this.getOwnedMailbox(id, user.id);

    return this.prisma.mailbox.update({
      where: { id: mailbox.id },
      data: {
        status: MailboxStatus.SUSPENDED,
      },
      include: mailboxInclude,
    });
  }

  async delete(id: string, user: AuthenticatedUser) {
    const mailbox = await this.getOwnedMailbox(id, user.id);

    await this.mailProvisioningService.deleteMailbox(mailbox.address);
    await this.prisma.mailbox.delete({ where: { id: mailbox.id } });

    return { deleted: true };
  }

  private async getOwnedMailbox(id: string, userId: string) {
    const mailbox = await this.prisma.mailbox.findFirst({
      where: {
        id,
        OR: [
          {
            userId,
            type: MailboxType.PERSONAL,
          },
          {
            organization: {
              ownerId: userId,
            },
            type: MailboxType.BUSINESS,
          },
        ],
      },
    });

    if (!mailbox) {
      throw new NotFoundException("Mailbox not found.");
    }

    return mailbox;
  }
}

const mailboxInclude = {
  domain: true,
  organization: {
    select: {
      id: true,
      name: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      primaryEmail: true,
      username: true,
    },
  },
} as const;

function requireText(value: string | undefined, field: string) {
  const text = value?.trim();

  if (!text) {
    throw new BadRequestException(`${field} is required.`);
  }

  return text;
}

function requirePassword(value: string | undefined) {
  if (!value || value.length < 10) {
    throw new BadRequestException("Mailbox password must be at least 10 characters.");
  }

  return value;
}

function normalizeQuota(value: number | undefined) {
  const quota = Number(value ?? 5120);

  if (!Number.isInteger(quota) || quota < 128 || quota > 102400) {
    throw new BadRequestException("quotaMb must be an integer between 128 and 102400.");
  }

  return quota;
}
