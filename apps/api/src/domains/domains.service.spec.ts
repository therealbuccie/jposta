import { NotFoundException } from "@nestjs/common";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DomainsService } from "./domains.service";

const originalMailHostname = process.env.MAIL_HOSTNAME;
const originalSpfIncludeHost = process.env.SPF_INCLUDE_HOST;

describe("DomainsService ownership", () => {
  afterEach(() => {
    setEnv("MAIL_HOSTNAME", originalMailHostname);
    setEnv("SPF_INCLUDE_HOST", originalSpfIncludeHost);
  });

  it("rejects domains outside the authenticated user's organizations", async () => {
    const service = new DomainsService(
      null as never,
      null as never,
      null as never,
      {
        domain: {
          findFirst: async () => null,
        },
      } as never,
    );

    await assert.rejects(() => service.getById("domain-id", user()), NotFoundException);
  });

  it("returns generated DNS records for an owned existing domain", async () => {
    process.env.MAIL_HOSTNAME = "mx1.jposta.test";
    process.env.SPF_INCLUDE_HOST = "_spf.jposta.test";

    const service = new DomainsService(
      null as never,
      null as never,
      null as never,
      {
        domain: {
          findFirst: async () => ({
            dkimPublicKey: "v=DKIM1; k=rsa; p=real-key",
            dkimSelector: "mail",
            id: "domain-id",
            name: "customer.example",
            organization: { id: "org-id", name: "Customer" },
            organizationId: "org-id",
            verificationToken: "verify-token",
          }),
        },
      } as never,
    );

    const result = await service.getDnsRecords("domain-id", user());

    assert.equal(result.domain, "customer.example");
    assert.ok(
      result.records.some(
        (record) => record.name === "mail._domainkey" && record.value === "v=DKIM1; k=rsa; p=real-key",
      ),
    );
    assert.ok(
      result.records.some(
        (record) => record.name === "_dmarc" && record.value.includes("dmarc@customer.example"),
      ),
    );
  });
});

function user() {
  return {
    id: "user-id",
    email: "a@b.com",
    name: "User",
    primaryEmail: "a@b.com",
    role: "USER",
    status: "ACTIVE",
    username: "a",
  } as never;
}

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
