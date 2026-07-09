import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { MailboxesController } from "./mailboxes.controller";
import { MailboxesService } from "./mailboxes.service";

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [MailboxesController],
  providers: [MailboxesService],
})
export class MailboxesModule {}
