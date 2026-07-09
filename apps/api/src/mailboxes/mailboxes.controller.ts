import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";

import type { RequestWithUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MailboxesService } from "./mailboxes.service";

@Controller("mailboxes")
@UseGuards(JwtAuthGuard)
export class MailboxesController {
  constructor(private readonly mailboxesService: MailboxesService) {}

  @Post()
  create(@Body() body: unknown, @Req() request: RequestWithUser) {
    return this.mailboxesService.create(
      body as {
        displayName?: string;
        domainId?: string;
        localPart?: string;
        organizationId?: string;
        userId?: string;
      },
      request.user,
    );
  }
}
