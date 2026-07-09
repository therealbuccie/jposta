import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";

import type { RequestWithUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DomainsService } from "./domains.service";

@Controller("domains")
@UseGuards(JwtAuthGuard)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Post()
  create(@Body() body: unknown, @Req() request: RequestWithUser) {
    return this.domainsService.create(
      body as { name?: string; organizationId?: string },
      request.user,
    );
  }
}
