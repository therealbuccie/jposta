import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DomainVerificationService } from "./domain-verification.service";

describe("DomainVerificationService", () => {
  it("passes all checks when expected DNS records exist", async () => {
    const service = new DomainVerificationService({
      resolveMx: async () => [{ exchange: "mail.jposta.com" }],
      resolveTxt: async (hostname: string) => {
        if (hostname.startsWith("_jposta-verification")) return [["jposta-verification=abc"]];
        if (hostname.startsWith("mail._domainkey")) return [["v=DKIM1; k=rsa; p=key"]];
        return [["v=spf1 include:_spf.jposta.com ~all"]];
      },
    });

    const result = await service.verify({
      dkimPublicKey: "v=DKIM1; k=rsa; p=key",
      dkimSelector: "mail",
      name: "golyvin.com",
      verificationToken: "abc",
    });

    assert.equal(result.verified, true);
    assert.equal(result.checks.mx.passed, true);
  });

  it("returns detailed failed checks when records are missing", async () => {
    const service = new DomainVerificationService({
      resolveMx: async () => [],
      resolveTxt: async () => [],
    });

    const result = await service.verify({
      dkimPublicKey: null,
      dkimSelector: "mail",
      name: "golyvin.com",
      verificationToken: "abc",
    });

    assert.equal(result.verified, false);
    assert.equal(result.checks.verification.actual.length, 0);
  });
});
