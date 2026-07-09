import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { DomainsModule } from "./domains/domains.module";
import { HealthModule } from "./health/health.module";
import { MailboxesModule } from "./mailboxes/mailboxes.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    DomainsModule,
    MailboxesModule,
  ],
})
export class AppModule {}
