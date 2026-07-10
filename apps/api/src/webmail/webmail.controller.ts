import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";

import { normalizeUid } from "./webmail.utils";
import { WebmailImapService } from "./webmail-imap.service";
import { WebmailRequest, WebmailSessionGuard } from "./webmail-session.guard";
import { WebmailSessionService } from "./webmail-session.service";
import { buildDraftMessage, WebmailSmtpService } from "./webmail-smtp.service";
import { WebmailService } from "./webmail.service";

@Controller("webmail")
export class WebmailController {
  constructor(
    private readonly imap: WebmailImapService,
    private readonly sessions: WebmailSessionService,
    private readonly smtp: WebmailSmtpService,
    private readonly webmailService: WebmailService,
  ) {}

  @Post("auth/login")
  login(@Body() body: unknown) {
    return this.webmailService.login(
      body as { email?: string; password?: string; portalSlug?: string },
    );
  }

  @Get("health")
  async health() {
    const [imapReachable, smtpReachable] = await Promise.all([
      this.imap.health(),
      this.smtp.health(),
    ]);
    return {
      status: imapReachable && smtpReachable ? "healthy" : "degraded",
      imapReachable,
      smtpReachable,
    };
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
    return this.sessions.logout(authorization?.slice(7) ?? "");
  }

  @Get("folders")
  @UseGuards(WebmailSessionGuard)
  folders(@Req() request: WebmailRequest) {
    return this.imap.listFolders(request.webmailSession);
  }

  @Get("messages")
  @UseGuards(WebmailSessionGuard)
  messages(@Req() request: WebmailRequest, @Query() query: Record<string, unknown>) {
    return this.imap.listMessages(request.webmailSession, query);
  }

  @Get("messages/:uid")
  @UseGuards(WebmailSessionGuard)
  message(
    @Req() request: WebmailRequest,
    @Param("uid") uid: string,
    @Query("folder") folder?: string,
  ) {
    return this.imap.getMessage(request.webmailSession, normalizeUid(uid), folder);
  }

  @Patch("messages/:uid/read")
  @UseGuards(WebmailSessionGuard)
  read(
    @Req() request: WebmailRequest,
    @Param("uid") uid: string,
    @Body() body: { folder?: string; read?: boolean },
  ) {
    return this.imap.setRead(
      request.webmailSession,
      normalizeUid(uid),
      body.folder,
      Boolean(body.read),
    );
  }

  @Patch("messages/:uid/star")
  @UseGuards(WebmailSessionGuard)
  star(
    @Req() request: WebmailRequest,
    @Param("uid") uid: string,
    @Body() body: { folder?: string; starred?: boolean },
  ) {
    return this.imap.setStar(
      request.webmailSession,
      normalizeUid(uid),
      body.folder,
      Boolean(body.starred),
    );
  }

  @Post("messages/:uid/move")
  @UseGuards(WebmailSessionGuard)
  move(
    @Req() request: WebmailRequest,
    @Param("uid") uid: string,
    @Body() body: { fromFolder?: string; toFolder?: string },
  ) {
    return this.imap.move(
      request.webmailSession,
      normalizeUid(uid),
      body.fromFolder,
      body.toFolder,
    );
  }

  @Delete("messages/:uid")
  @UseGuards(WebmailSessionGuard)
  delete(
    @Req() request: WebmailRequest,
    @Param("uid") uid: string,
    @Query("folder") folder?: string,
  ) {
    return this.imap.delete(request.webmailSession, normalizeUid(uid), folder);
  }

  @Get("messages/:uid/attachments/:partId")
  @UseGuards(WebmailSessionGuard)
  attachment(
    @Req() request: WebmailRequest,
    @Param("uid") uid: string,
    @Param("partId") partId: string,
    @Query("folder") folder?: string,
  ) {
    return this.imap.getAttachment(request.webmailSession, normalizeUid(uid), partId, folder);
  }

  @Post("send")
  @UseGuards(WebmailSessionGuard)
  @UseInterceptors(AnyFilesInterceptor({ limits: { files: 10, fileSize: 25 * 1024 * 1024 } }))
  send(
    @Req() request: WebmailRequest,
    @Body() body: Record<string, string>,
    @UploadedFiles()
    files: Array<{ buffer?: Buffer; mimetype?: string; originalname?: string; size?: number }> = [],
  ) {
    return this.smtp.send(request.webmailSession, body, files);
  }

  @Post("drafts")
  @UseGuards(WebmailSessionGuard)
  createDraft(@Req() request: WebmailRequest, @Body() body: Record<string, string>) {
    return this.imap.saveDraft(
      request.webmailSession,
      buildDraftMessage(request.webmailSession, body),
    );
  }

  @Patch("drafts/:uid")
  @UseGuards(WebmailSessionGuard)
  updateDraft(
    @Req() request: WebmailRequest,
    @Param("uid") uid: string,
    @Body() body: Record<string, string>,
  ) {
    return this.imap.saveDraft(
      request.webmailSession,
      buildDraftMessage(request.webmailSession, body),
      normalizeUid(uid),
    );
  }

  @Delete("drafts/:uid")
  @UseGuards(WebmailSessionGuard)
  deleteDraft(@Req() request: WebmailRequest, @Param("uid") uid: string) {
    return this.imap.deleteDraft(request.webmailSession, normalizeUid(uid));
  }
}
