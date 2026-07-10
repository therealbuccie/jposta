import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";

import { WebmailRequest, WebmailSessionGuard } from "./webmail-session.guard";
import { WebmailService } from "./webmail.service";

@Controller("webmail")
export class WebmailController {
  constructor(private readonly webmailService: WebmailService) {}

  @Post("auth/login")
  login(@Body() body: unknown) {
    return this.webmailService.login(
      body as { email?: string; password?: string; portalSlug?: string },
    );
  }

  @Get("me")
  @UseGuards(WebmailSessionGuard)
  me(@Req() request: WebmailRequest) {
    return this.webmailService.meFromSession(request.webmailSession);
  }

  @Post("logout")
  @UseGuards(WebmailSessionGuard)
  logout(@Req() request: WebmailRequest) {
    const header = request.headers.authorization;
    const authorization = Array.isArray(header) ? header[0] : header;
    return this.webmailService.logout(authorization?.slice(7) ?? "");
  }
}
