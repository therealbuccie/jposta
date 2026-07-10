import { Module } from "@nestjs/common";

import { ImapAuthenticator } from "./imap-authenticator.service";
import { WebmailController } from "./webmail.controller";
import { WebmailSessionGuard } from "./webmail-session.guard";
import { WebmailService } from "./webmail.service";

@Module({
  controllers: [WebmailController],
  providers: [ImapAuthenticator, WebmailService, WebmailSessionGuard],
  exports: [WebmailService],
})
export class WebmailModule {}
