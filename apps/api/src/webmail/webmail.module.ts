import { Module } from "@nestjs/common";

import { ImapAuthenticator } from "./imap-authenticator.service";
import { WebmailController } from "./webmail.controller";
import { WebmailImapService } from "./webmail-imap.service";
import { WebmailSessionGuard } from "./webmail-session.guard";
import { WebmailSessionService } from "./webmail-session.service";
import { WebmailSmtpService } from "./webmail-smtp.service";
import { WebmailService } from "./webmail.service";

@Module({
  controllers: [WebmailController],
  providers: [
    ImapAuthenticator,
    WebmailImapService,
    WebmailService,
    WebmailSessionGuard,
    WebmailSessionService,
    WebmailSmtpService,
  ],
  exports: [WebmailService, WebmailSessionService],
})
export class WebmailModule {}
