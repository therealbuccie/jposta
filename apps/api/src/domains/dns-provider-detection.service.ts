import { Injectable } from "@nestjs/common";
import { DnsProvider } from "@prisma/client";
import { promises as dns } from "node:dns";

@Injectable()
export class DnsProviderDetectionService {
  async detect(domain: string) {
    let nameservers: string[] = [];
    try {
      nameservers = (await dns.resolveNs(domain)).map((value) =>
        value.toLowerCase().replace(/\.$/, ""),
      );
    } catch {
      // A domain can be added before its delegation is publicly resolvable.
    }

    const provider = nameservers.some((value) => value.endsWith(".ns.cloudflare.com"))
      ? DnsProvider.CLOUDFLARE
      : nameservers.some(
            (value) =>
              value.endsWith(".registrar-servers.com") || value.endsWith(".namecheaphosting.com"),
          )
        ? DnsProvider.NAMECHEAP
        : DnsProvider.UNKNOWN;

    return {
      provider,
      nameservers: [...new Set(nameservers)].sort(),
      detectedAt: new Date(),
      automationAvailable: provider !== DnsProvider.UNKNOWN,
    };
  }
}
