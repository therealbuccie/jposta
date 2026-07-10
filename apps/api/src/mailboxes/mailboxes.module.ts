import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { MailProvisioningModule } from "../mail-provisioning/mail-provisioning.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { MailboxesController } from "./mailboxes.controller";
import { MailboxesService } from "./mailboxes.service";

@Module({
  imports: [AuthModule, OrganizationsModule, MailProvisioningModule],
  controllers: [MailboxesController],
  providers: [MailboxesService],
})
export class MailboxesModule {}
