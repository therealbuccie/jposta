import { BadRequestException } from "@nestjs/common";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDraftMessage, WebmailSmtpService } from "./webmail-smtp.service";

const session = {
  mailbox: { address: "info@golivyn.com" },
  credential: "secret",
} as never;

describe("WebmailSmtpService validation", () => {
  it("rejects spoofed From fields", async () => {
    const service = new WebmailSmtpService();
    await assert.rejects(
      () => service.send(session, { from: "evil@example.com", to: "a@example.com" } as never),
      BadRequestException,
    );
  });

  it("rejects excessive attachment size", async () => {
    const service = new WebmailSmtpService();
    await assert.rejects(
      () =>
        service.send(session, { to: "a@example.com" }, [
          { originalname: "a.txt", size: 26 * 1024 * 1024 },
        ]),
      BadRequestException,
    );
  });

  it("builds draft messages from the authenticated mailbox", () => {
    const draft = buildDraftMessage(session, {
      to: "a@example.com",
      subject: "Hello",
      text: "Draft",
    });
    assert.match(draft, /From: info@golivyn.com/);
    assert.match(draft, /Subject: Hello/);
  });
});
