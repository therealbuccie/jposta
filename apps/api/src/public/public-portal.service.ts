import { Injectable, NotFoundException } from "@nestjs/common";
import { PortalStatus } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { isReservedPortalSlug, normalizePortalSlug } from "../organizations/portal-slug.utils";

@Injectable()
export class PublicPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortal(slugValue: string) {
    const slug = normalizePortalSlug(slugValue);

    if (isReservedPortalSlug(slug)) {
      throw new NotFoundException("Portal not found.");
    }

    const organization = await this.prisma.organization.findUnique({
      where: { slug },
      select: {
        name: true,
        slug: true,
        mailPortalEnabled: true,
        portalDisplayName: true,
        portalLogoUrl: true,
        portalWelcomeMessage: true,
        portalStatus: true,
      },
    });

    if (
      !organization ||
      !organization.mailPortalEnabled ||
      organization.portalStatus !== PortalStatus.ACTIVE
    ) {
      throw new NotFoundException("Portal not found.");
    }

    return {
      slug: organization.slug,
      organizationName: organization.name,
      portalDisplayName: organization.portalDisplayName,
      portalLogoUrl: organization.portalLogoUrl,
      portalWelcomeMessage: organization.portalWelcomeMessage,
      portalStatus: organization.portalStatus,
    };
  }
}
