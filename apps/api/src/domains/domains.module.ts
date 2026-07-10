import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { DkimService } from "./dkim.service";
import { DomainVerificationService } from "./domain-verification.service";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [DomainsController],
  providers: [DkimService, DomainVerificationService, DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
