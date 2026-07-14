import { BadRequestException } from "@nestjs/common";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildDomainDnsRecords, normalizeDomainName } from "./domain.utils";

const originalMailHostname = process.env.MAIL_HOSTNAME;
const originalMailServerIp = process.env.MAIL_SERVER_IP;
const originalSpfIncludeHost = process.env.SPF_INCLUDE_HOST;

describe("normalizeDomainName", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("normalizes lowercase domains and removes a trailing dot", () => {
    assert.equal(normalizeDomainName(" Customer.Example. "), "customer.example");
  });

  it("rejects unsafe or invalid domains", () => {
    assert.throws(() => normalizeDomainName("bad;domain.com"), BadRequestException);
    assert.throws(() => normalizeDomainName("-bad.example"), BadRequestException);
    assert.throws(() => normalizeDomainName("bad..example.com"), BadRequestException);
  });

  it("generates dynamic DNS records from domain data and configuration", () => {
    process.env.MAIL_HOSTNAME = "mx1.jposta.test";
    process.env.MAIL_SERVER_IP = "203.0.113.25";
    process.env.SPF_INCLUDE_HOST = "_spf.jposta.test";

    const records = buildDomainDnsRecords({
      dkimPublicKey: "v=DKIM1; k=rsa; p=real-key",
      dkimSelector: "mail",
      name: "customer.example",
      verificationToken: "verify-token",
    });

    assert.deepEqual(records, [
      { type: "TXT", name: "_jposta-verification", value: "jposta-verification=verify-token" },
      { type: "MX", name: "@", value: "mx1.jposta.test", priority: 10 },
      { type: "TXT", name: "@", value: "v=spf1 include:_spf.jposta.test ~all" },
      { type: "TXT", name: "mail._domainkey", value: "v=DKIM1; k=rsa; p=real-key" },
      { type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none; rua=mailto:dmarc@customer.example" },
      { type: "A", name: "mail", value: "203.0.113.25" },
    ]);
  });

  it("omits the optional A record when no mail server IP is configured", () => {
    process.env.MAIL_HOSTNAME = "mx1.jposta.test";
    process.env.SPF_INCLUDE_HOST = "_spf.jposta.test";
    delete process.env.MAIL_SERVER_IP;

    const records = buildDomainDnsRecords({
      dkimPublicKey: "v=DKIM1; k=rsa; p=real-key",
      dkimSelector: "mail",
      name: "customer.example",
      verificationToken: "verify-token",
    });

    assert.equal(records.some((record) => record.type === "A"), false);
  });
});

function restoreEnv() {
  setEnv("MAIL_HOSTNAME", originalMailHostname);
  setEnv("MAIL_SERVER_IP", originalMailServerIp);
  setEnv("SPF_INCLUDE_HOST", originalSpfIncludeHost);
}

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
