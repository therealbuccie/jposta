import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { promises as dns } from "node:dns";

import { DomainVerificationService } from "./domain-verification.service";

describe("DomainVerificationService", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("passes all checks when expected DNS records exist", async () => {
    mock.method(dns, "resolveMx", async () => [
      { exchange: "mail.jposta.com", priority: 10 },
    ]);

    mock.method(dns, "resolveTxt", async (hostname: string) => {
      if (hostname.startsWith("_jposta-verification")) {
        return [["jposta-verification=abc"]];
      }

      if (hostname.startsWith("mail._domainkey")) {
        return [["v=DKIM1; k=rsa; p=key"]];
      }

      return [["v=spf1 include:_spf.jposta.com ~all"]];
    });

    const service = new DomainVerificationService();

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
    mock.method(dns, "resolveMx", async () => []);
    mock.method(dns, "resolveTxt", async () => []);

    const service = new DomainVerificationService();

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