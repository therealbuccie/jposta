import { Module } from "@nestjs/common";

import { MailProvisioningService } from "./mail-provisioning.service";

@Module({
  providers: [MailProvisioningService],
  exports: [MailProvisioningService],
})
export class MailProvisioningModule {}
