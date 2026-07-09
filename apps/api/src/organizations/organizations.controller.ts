import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { RequestWithUser } from "../auth/auth.types";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(@Body() body: unknown, @Req() request: RequestWithUser) {
    return this.organizationsService.create(body as { name?: string; slug?: string }, request.user);
  }
}
