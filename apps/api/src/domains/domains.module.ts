import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [DomainsController],
  providers: [DomainsService],
})
export class DomainsModule {}
