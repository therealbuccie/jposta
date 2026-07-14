import { Controller, Get, Query, Res } from "@nestjs/common";

import { DnsProviderAutomationService } from "./dns-provider-automation.service";

type RedirectResponse = { redirect(url: string): void };

@Controller("domains/provider")
export class DnsProviderCallbackController {
  constructor(private readonly automation: DnsProviderAutomationService) {}

  @Get("cloudflare/callback")
  async cloudflareCallback(
    @Query("code") code: string | undefined,
    @Query("error") error: string | undefined,
    @Query("state") state: string | undefined,
    @Res() response: RedirectResponse,
  ) {
    response.redirect(await this.automation.completeCloudflare({ code, error, state }));
  }
}
