import { DnsProvider } from "@prisma/client";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { promises as dns } from "node:dns";

import { DnsProviderDetectionService } from "./dns-provider-detection.service";

describe("DnsProviderDetectionService", () => {
  afterEach(() => mock.restoreAll());

  it("detects Cloudflare and Namecheap authoritative nameservers", async () => {
    const service = new DnsProviderDetectionService();
    mock.method(dns, "resolveNs", async () => ["Ada.NS.Cloudflare.com", "Bob.NS.Cloudflare.com"]);
    assert.equal((await service.detect("example.com")).provider, DnsProvider.CLOUDFLARE);

    mock.restoreAll();
    mock.method(dns, "resolveNs", async () => ["dns1.registrar-servers.com"]);
    assert.equal((await service.detect("example.com")).provider, DnsProvider.NAMECHEAP);
  });

  it("falls back safely when nameservers cannot be resolved", async () => {
    mock.method(dns, "resolveNs", async () => {
      throw new Error("NXDOMAIN");
    });
    const result = await new DnsProviderDetectionService().detect("example.com");
    assert.equal(result.provider, DnsProvider.UNKNOWN);
    assert.deepEqual(result.nameservers, []);
  });
});
