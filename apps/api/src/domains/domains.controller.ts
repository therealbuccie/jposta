import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";

import type { RequestWithUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DomainsService } from "./domains.service";

@Controller("domains")
@UseGuards(JwtAuthGuard)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  list(@Req() request: RequestWithUser) {
    return this.domainsService.list(request.user);
  }

  @Post()
  create(@Body() body: unknown, @Req() request: RequestWithUser) {
    return this.domainsService.create(
      body as { name?: string; organizationId?: string },
      request.user,
    );
  }

  @Get(":id")
  getById(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.domainsService.getById(id, request.user);
  }

  @Get(":id/dns-records")
  getDnsRecords(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.domainsService.getDnsRecords(id, request.user);
  }

  @Post(":id/verify")
  verify(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.domainsService.verify(id, request.user);
  }
}
