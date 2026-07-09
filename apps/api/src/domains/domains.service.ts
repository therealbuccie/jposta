import { BadRequestException, Injectable } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/auth.types";
import { OrganizationsService } from "../organizations/organizations.service";
import { PrismaService } from "../prisma/prisma.service";

type AddDomainInput = {
  name?: string;
  organizationId?: string;
};

@Injectable()
export class DomainsService {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly prisma: PrismaService,
  ) {}

  async create(input: AddDomainInput, user: AuthenticatedUser) {
    const organization = await this.organizationsService.ensureOwnedByUser(
      input.organizationId,
      user.id,
    );
    const name = normalizeDomain(input.name);

    return this.prisma.domain.create({
      data: {
        name,
        organizationId: organization.id,
      },
    });
  }
}

function normalizeDomain(value: string | undefined) {
  const domain = value?.trim().toLowerCase();

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    throw new BadRequestException("A valid domain name is required.");
  }

  return domain;
}
