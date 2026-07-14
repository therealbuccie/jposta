import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";

import type { RequestWithUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DomainsService } from "./domains.service";
import { DnsProviderAutomationService } from "./dns-provider-automation.service";

@Controller("domains")
@UseGuards(JwtAuthGuard)
export class DomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly dnsProviderAutomationService: DnsProviderAutomationService,
  ) {}

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

  @Post(":id/provider/detect")
  redetectProvider(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.dnsProviderAutomationService.redetect(id, request.user);
  }

  @Post(":id/provider/cloudflare/authorize")
  authorizeCloudflare(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.dnsProviderAutomationService.beginCloudflare(id, request.user);
  }

  @Post(":id/provider/namecheap/connect")
  connectNamecheap(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: RequestWithUser,
  ) {
    return this.dnsProviderAutomationService.connectNamecheap(
      id,
      body as { apiKey?: string; apiUser?: string },
      request.user,
    );
  }

  @Get(":id/provider")
  providerStatus(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.dnsProviderAutomationService.connectionStatus(id, request.user);
  }

  @Get(":id/dns-plan")
  previewDnsPlan(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.dnsProviderAutomationService.preview(id, request.user);
  }

  @Post(":id/dns-plan/apply")
  applyDnsPlan(@Param("id") id: string, @Body() body: unknown, @Req() request: RequestWithUser) {
    return this.dnsProviderAutomationService.apply(
      id,
      body as { confirmConflicts?: boolean; sourceFingerprint?: string },
      request.user,
    );
  }

  @Delete(":id/provider")
  disconnectProvider(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.dnsProviderAutomationService.disconnect(id, request.user);
  }
}
