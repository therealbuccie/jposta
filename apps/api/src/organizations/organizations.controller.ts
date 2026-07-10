import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { PortalStatus } from "@prisma/client";

import type { RequestWithUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  list(@Req() request: RequestWithUser) {
    return this.organizationsService.list(request.user);
  }

  @Post()
  create(@Body() body: unknown, @Req() request: RequestWithUser) {
    return this.organizationsService.create(body as { name?: string; slug?: string }, request.user);
  }

  @Patch(":id/mail-portal")
  updateMailPortal(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: RequestWithUser,
  ) {
    return this.organizationsService.updateMailPortal(
      id,
      body as {
        mailPortalEnabled?: boolean;
        portalDisplayName?: string | null;
        portalLogoUrl?: string | null;
        portalWelcomeMessage?: string | null;
        portalStatus?: PortalStatus;
        slug?: string;
      },
      request.user,
    );
  }
}
