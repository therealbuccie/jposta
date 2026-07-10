import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

type CreateOrganizationInput = {
  name?: string;
  slug?: string;
};

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser) {
    return this.prisma.organization.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(input: CreateOrganizationInput, user: AuthenticatedUser) {
    const name = requireText(input.name, "name");
    const slug = toSlug(input.slug || name);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          ownerId: user.id,
        },
        include: {
          domains: true,
          mailboxes: true,
        },
      });

      await tx.user.updateMany({
        where: {
          id: user.id,
          role: UserRole.USER,
        },
        data: {
          role: UserRole.WORKSPACE_OWNER,
        },
      });

      return organization;
    });
  }

  async ensureOwnedByUser(organizationId: string | undefined, userId: string) {
    const id = requireText(organizationId, "organizationId");
    const organization = await this.prisma.organization.findFirst({
      where: {
        id,
        ownerId: userId,
      },
    });

    if (!organization) {
      throw new NotFoundException("Organization not found.");
    }

    return organization;
  }
}

function requireText(value: string | undefined, field: string) {
  const text = value?.trim();

  if (!text) {
    throw new BadRequestException(`${field} is required.`);
  }

  return text;
}

function toSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) {
    throw new BadRequestException("A valid organization slug is required.");
  }

  return slug;
}
