import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";

import type { RequestWithUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MailboxesService } from "./mailboxes.service";

@Controller("mailboxes")
@UseGuards(JwtAuthGuard)
export class MailboxesController {
  constructor(private readonly mailboxesService: MailboxesService) {}

  @Get()
  list(@Req() request: RequestWithUser) {
    return this.mailboxesService.list(request.user);
  }

  @Post()
  create(@Body() body: unknown, @Req() request: RequestWithUser) {
    return this.mailboxesService.create(
      body as {
        displayName?: string;
        domainId?: string;
        localPart?: string;
        organizationId?: string;
        password?: string;
        quotaMb?: number;
        userId?: string;
      },
      request.user,
    );
  }

  @Patch(":id/password")
  updatePassword(@Param("id") id: string, @Body() body: unknown, @Req() request: RequestWithUser) {
    return this.mailboxesService.updatePassword(id, body as { password?: string }, request.user);
  }

  @Patch(":id/suspend")
  suspend(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.mailboxesService.suspend(id, request.user);
  }

  @Delete(":id")
  delete(@Param("id") id: string, @Req() request: RequestWithUser) {
    return this.mailboxesService.delete(id, request.user);
  }
}
