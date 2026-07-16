import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WebmailImapService } from "./webmail-imap.service";
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

  it("appends exactly one raw Sent copy after successful SMTP delivery", async () => {
    const imap = fakeImap();
    const service = new TestWebmailSmtpService(imap.service);

    const result = await service.send(session, {
      html: "<p><strong>Hello</strong></p>",
      subject: "Hello",
      to: "a@example.com",
    });

    assert.equal(result.messageId, "smtp-id");
    assert.equal(imap.calls.length, 1);
    assert.match(imap.calls[0]!.raw.toString(), /<strong>Hello<\/strong>/);
    assert.equal(service.smtpMessages.length, 1);
  });

  it("does not append to Sent when SMTP delivery fails", async () => {
    const imap = fakeImap();
    const service = new TestWebmailSmtpService(imap.service, { failSmtp: true });

    await assert.rejects(
      () => service.send(session, { subject: "Nope", to: "a@example.com", text: "Body" }),
      ServiceUnavailableException,
    );
    assert.equal(imap.calls.length, 0);
  });

  it("keeps SMTP success when Sent append fails", async () => {
    const imap = fakeImap({ failAppend: true });
    const service = new TestWebmailSmtpService(imap.service);
    const originalWarn = console.warn;
    const warnings: unknown[] = [];
    console.warn = (...values: unknown[]) => { warnings.push(values); };
    try {
      const result = await service.send(session, { subject: "Delivered", to: "a@example.com", text: "Body" });
      assert.equal(result.messageId, "smtp-id");
      assert.equal(imap.calls.length, 1);
      assert.equal(warnings.length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("preserves attachments and HTML in the stored MIME", async () => {
    const imap = fakeImap();
    const service = new TestWebmailSmtpService(imap.service);

    await service.send(
      session,
      { html: "<table><tr><td>Invoice</td></tr></table>", subject: "Invoice", to: "a@example.com" },
      [{ buffer: Buffer.from("invoice data"), mimetype: "text/plain", originalname: "invoice.txt", size: 12 }],
    );

    const raw = imap.calls[0]!.raw.toString();
    assert.match(raw, /<table><tr><td>Invoice<\/td><\/tr><\/table>/);
    assert.match(raw, /invoice\.txt/);
  });
});

type FakeImapCall = { raw: Buffer; session: unknown };

function fakeImap(options: { failAppend?: boolean } = {}) {
  const calls: FakeImapCall[] = [];
  const service = {
    appendSentMessage: async (activeSession: unknown, raw: Buffer) => {
      calls.push({ raw, session: activeSession });
      if (options.failAppend) throw new Error("append failed");
      return { appended: true, folder: "Sent" };
    },
  } as unknown as WebmailImapService;
  return { calls, service };
}

class TestWebmailSmtpService extends WebmailSmtpService {
  readonly smtpMessages: Record<string, unknown>[] = [];

  constructor(imap: WebmailImapService, private readonly options: { failSmtp?: boolean } = {}) {
    super(imap);
  }

  protected override createSmtpTransporter() {
    return {
      sendMail: async (message: Record<string, unknown>) => {
        this.smtpMessages.push(message);
        if (this.options.failSmtp) throw new Error("smtp failed");
        return { accepted: ["a@example.com"], messageId: "smtp-id", rejected: [] };
      },
      verify: async () => true,
    };
  }
}
