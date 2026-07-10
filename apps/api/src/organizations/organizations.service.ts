import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PortalStatus, UserRole } from "@prisma/client";

import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { normalizePortalSlug, portalUrl, slugFromOrganizationName } from "./portal-slug.utils";

type CreateOrganizationInput = {
  name?: string;
  slug?: string;
};

type UpdateMailPortalInput = {
  mailPortalEnabled?: boolean;
  portalDisplayName?: string | null;
  portalLogoUrl?: string | null;
  portalWelcomeMessage?: string | null;
  portalStatus?: PortalStatus;
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
    const slug = await this.resolveUniqueSlug(
      input.slug ? normalizePortalSlug(input.slug) : slugFromOrganizationName(name),
    );

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          portalDisplayName: name,
          portalWelcomeMessage: `Welcome to ${name} mail.`,
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

      return {
        ...organization,
        portalUrl: portalUrl(organization.slug),
      };
    });
  }

  async updateMailPortal(id: string, input: UpdateMailPortalInput, user: AuthenticatedUser) {
    const organization = await this.ensureOwnedByUser(id, user.id);

    if (input.slug && normalizePortalSlug(input.slug) !== organization.slug) {
      throw new BadRequestException("Portal slug editing is disabled for this MVP.");
    }

    const updated = await this.prisma.organization.update({
      where: { id: organization.id },
      data: {
        ...(typeof input.mailPortalEnabled === "boolean"
          ? { mailPortalEnabled: input.mailPortalEnabled }
          : {}),
        ...(input.portalDisplayName !== undefined
          ? { portalDisplayName: cleanOptionalText(input.portalDisplayName) }
          : {}),
        ...(input.portalLogoUrl !== undefined
          ? { portalLogoUrl: cleanOptionalText(input.portalLogoUrl) }
          : {}),
        ...(input.portalWelcomeMessage !== undefined
          ? { portalWelcomeMessage: cleanOptionalText(input.portalWelcomeMessage) }
          : {}),
        ...(input.portalStatus ? { portalStatus: input.portalStatus } : {}),
      },
    });

    if (updated.portalStatus === PortalStatus.DISABLED || !updated.mailPortalEnabled) {
      await this.prisma.webmailSession.updateMany({
        where: {
          organizationId: updated.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return {
      ...updated,
      portalUrl: portalUrl(updated.slug),
    };
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

  private async resolveUniqueSlug(baseSlug: string) {
    const base = normalizePortalSlug(baseSlug);
    let candidate = base;
    let attempt = 1;

    while (await this.prisma.organization.findUnique({ where: { slug: candidate } })) {
      const suffix = `-${attempt + 1}`;
      candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`;
      attempt += 1;
    }

    return candidate;
  }
}

function requireText(value: string | undefined, field: string) {
  const text = value?.trim();

  if (!text) {
    throw new BadRequestException(`${field} is required.`);
  }

  return text;
}

function cleanOptionalText(value: string | null | undefined) {
  const text = value?.trim();
  return text || null;
}
