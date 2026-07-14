import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { DkimService } from "./dkim.service";
import { CloudflareDnsService } from "./cloudflare-dns.service";
import { DnsProviderAutomationService } from "./dns-provider-automation.service";
import { DnsProviderCallbackController } from "./dns-provider-callback.controller";
import { DnsProviderDetectionService } from "./dns-provider-detection.service";
import { NamecheapDnsService } from "./namecheap-dns.service";
import { DomainVerificationService } from "./domain-verification.service";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [DomainsController, DnsProviderCallbackController],
  providers: [
    CloudflareDnsService,
    DkimService,
    DnsProviderAutomationService,
    DnsProviderDetectionService,
    DomainVerificationService,
    DomainsService,
    NamecheapDnsService,
  ],
  exports: [DomainsService],
})
export class DomainsModule {}
