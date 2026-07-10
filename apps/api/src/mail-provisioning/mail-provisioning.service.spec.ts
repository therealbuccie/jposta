import { ServiceUnavailableException } from "@nestjs/common";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { MailProvisioningService } from "./mail-provisioning.service";

const originalFetch = global.fetch;

describe("MailProvisioningService", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.MAIL_PROVISIONER_URL;
    delete process.env.MAIL_PROVISIONER_TOKEN;
  });

  it("fails clearly when the provisioner is not configured", async () => {
    const service = new MailProvisioningService();

    await assert.rejects(
      () =>
        service.createMailbox({ address: "a@example.com", password: "secret12345", quotaMb: 5120 }),
      ServiceUnavailableException,
    );
  });

  it("fails clearly on non-2xx provisioner responses", async () => {
    process.env.MAIL_PROVISIONER_URL = "http://127.0.0.1:4100";
    process.env.MAIL_PROVISIONER_TOKEN = "token";
    global.fetch = async () => new Response("nope", { status: 500 });
    const service = new MailProvisioningService();

    await assert.rejects(
      () =>
        service.createMailbox({ address: "a@example.com", password: "secret12345", quotaMb: 5120 }),
      ServiceUnavailableException,
    );
  });
});
