import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { promises as dns } from "node:dns";

import { DomainVerificationService } from "./domain-verification.service";

const originalMailHostname = process.env.MAIL_HOSTNAME;
const originalSpfIncludeHost = process.env.SPF_INCLUDE_HOST;

describe("DomainVerificationService", () => {
  afterEach(() => {
    mock.restoreAll();
    restoreEnv();
  });

  it("passes all checks when expected DNS records exist", async () => {
    process.env.MAIL_HOSTNAME = "mx1.jposta.test";
    process.env.SPF_INCLUDE_HOST = "_spf.jposta.test";
    mock.method(dns, "resolveMx", async () => [{ exchange: "mx1.jposta.test", priority: 10 }]);

    mock.method(dns, "resolveTxt", async (hostname: string) => {
      if (hostname.startsWith("_jposta-verification")) {
        return [["jposta-verification=abc"]];
      }

      if (hostname.startsWith("mail._domainkey")) {
        return [["v=DKIM1; k=rsa; p=key"]];
      }

      return [["v=spf1 include:_spf.jposta.test ~all"]];
    });

    const service = new DomainVerificationService();

    const result = await service.verify({
      dkimPublicKey: "v=DKIM1; k=rsa; p=key",
      dkimSelector: "mail",
      name: "customer.example",
      verificationToken: "abc",
    });

    assert.equal(result.verified, true);
    assert.equal(result.checks.mx.expected, "mx1.jposta.test");
    assert.equal(result.checks.mx.passed, true);
    assert.equal(result.checks.spf.expected, "include:_spf.jposta.test");
  });

  it("returns detailed failed checks when records are missing", async () => {
    process.env.MAIL_HOSTNAME = "mx1.jposta.test";
    process.env.SPF_INCLUDE_HOST = "_spf.jposta.test";
    mock.method(dns, "resolveMx", async () => []);
    mock.method(dns, "resolveTxt", async () => []);

    const service = new DomainVerificationService();

    const result = await service.verify({
      dkimPublicKey: null,
      dkimSelector: "mail",
      name: "customer.example",
      verificationToken: "abc",
    });

    assert.equal(result.verified, false);
    assert.equal(result.checks.verification.actual.length, 0);
  });
});

function restoreEnv() {
  setEnv("MAIL_HOSTNAME", originalMailHostname);
  setEnv("SPF_INCLUDE_HOST", originalSpfIncludeHost);
}

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
