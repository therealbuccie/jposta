import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { DomainsModule } from "./domains/domains.module";
import { HealthModule } from "./health/health.module";
import { MailboxesModule } from "./mailboxes/mailboxes.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PublicPortalModule } from "./public/public-portal.module";
import { WebmailModule } from "./webmail/webmail.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    DomainsModule,
    MailboxesModule,
    PublicPortalModule,
    WebmailModule,
  ],
})
export class AppModule {}
