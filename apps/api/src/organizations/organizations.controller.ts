import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";

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
}
