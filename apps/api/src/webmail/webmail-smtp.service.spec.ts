import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";

import { buildDraftMessage, WebmailSmtpService } from "./webmail-smtp.service";

const session = {
  mailbox: { address: "info@golivyn.com" },
  credential: "secret",
} as never;

describe("WebmailSmtpService validation", () => {
  it("rejects spoofed From fields", async () => {
    const service = new TestWebmailSmtpService();
    await assert.rejects(
      () => service.send(session, { from: "evil@example.com", to: "a@example.com" } as never),
      BadRequestException,
    );
  });

  it("rejects excessive attachment size", async () => {
    const service = new TestWebmailSmtpService();
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

describe("WebmailSmtpService Sent persistence", () => {
  it("successful SMTP send appends exactly once to Sent with Seen", async () => {
    const imap = new FakeSentImapClient({ boxes: boxesWithSent("Sent") });
    const service = new TestWebmailSmtpService({ imapClients: [imap] });

    const result = await service.send(session, messageInput());

    assert.deepEqual(result, {
      messageId: "smtp-message-id",
      accepted: ["client@example.com"],
      rejected: [],
    });
    assert.equal(service.smtpMessages.length, 1);
    assert.equal(imap.appends.length, 1);
    assert.equal(imap.appends[0]!.mailbox, "Sent");
    assert.deepEqual(imap.appends[0]!.flags, ["\\Seen"]);
    assert.deepEqual(imap.operations, ["connect", "getBoxes", "append:Sent", "end"]);
  });

  it("SMTP failure does not append", async () => {
    const imap = new FakeSentImapClient({ boxes: boxesWithSent("Sent") });
    const service = new TestWebmailSmtpService({
      imapClients: [imap],
      smtpError: new Error("SMTP failed"),
    });

    await assert.rejects(() => service.send(session, messageInput()), ServiceUnavailableException);
    assert.equal(imap.appends.length, 0);
  });

  it("Sent append failure does not turn successful delivery into API failure", async () => {
    const imap = new FakeSentImapClient({
      appendError: new Error("APPEND failed"),
      boxes: boxesWithSent("Sent"),
    });
    const service = new TestWebmailSmtpService({ imapClients: [imap] });

    const result = await service.send(session, messageInput());

    assert.equal(result.messageId, "smtp-message-id");
    assert.equal(service.smtpMessages.length, 1);
    assert.equal(imap.appends.length, 1);
  });

  it("prefers real Sent folder path from special-use metadata", async () => {
    const imap = new FakeSentImapClient({ boxes: boxesWithSent("Sent Items") });
    const service = new TestWebmailSmtpService({ imapClients: [imap] });

    await service.send(session, messageInput());

    assert.equal(imap.appends[0]!.mailbox, "Sent Items");
  });

  it("falls back to literal Sent path", async () => {
    const imap = new FakeSentImapClient({
      boxes: { INBOX: { attribs: ["\\Inbox"], delimiter: "/", children: null } },
    });
    const service = new TestWebmailSmtpService({ imapClients: [imap] });

    await service.send(session, messageInput());

    assert.equal(imap.appends[0]!.mailbox, "Sent");
  });

  it("attachments are present in stored MIME", async () => {
    const imap = new FakeSentImapClient({ boxes: boxesWithSent("Sent") });
    const service = new TestWebmailSmtpService({ imapClients: [imap] });

    await service.send(session, messageInput(), [
      {
        buffer: Buffer.from("Invoice data"),
        mimetype: "text/plain",
        originalname: "invoice.txt",
        size: 12,
      },
    ]);

    const stored = imap.appends[0]!.message.toString("utf8");
    assert.match(stored, /invoice\.txt/);
    assert.match(stored, /Content-Disposition: attachment/);
  });

  it("does not create duplicate appends", async () => {
    const imap = new FakeSentImapClient({ boxes: boxesWithSent("Sent") });
    const service = new TestWebmailSmtpService({ imapClients: [imap] });

    await service.send(session, messageInput());

    assert.equal(imap.appends.length, 1);
  });
});

function messageInput() {
  return {
    bcc: "audit@example.com",
    cc: "copy@example.com",
    html: "<p>Hello client</p>",
    inReplyTo: "<original@example.com>",
    references: "<thread@example.com> <original@example.com>",
    replyTo: "support@golivyn.com",
    subject: "Launch update",
    text: "Hello client",
    to: "client@example.com",
  };
}

function boxesWithSent(name: string) {
  return {
    INBOX: { attribs: ["\\Inbox"], delimiter: "/", children: null },
    [name]: { attribs: ["\\Sent"], delimiter: "/", children: null },
  };
}

class TestWebmailSmtpService extends WebmailSmtpService {
  readonly smtpMessages: unknown[] = [];
  private readonly imapClients: FakeSentImapClient[];
  private readonly smtpError: Error | undefined;

  constructor(options: { imapClients?: FakeSentImapClient[]; smtpError?: Error } = {}) {
    super();
    this.imapClients = options.imapClients ?? [];
    this.smtpError = options.smtpError;
  }

  protected override createSmtpTransport() {
    return {
      sendMail: async (message: unknown) => {
        this.smtpMessages.push(message);
        if (this.smtpError) throw this.smtpError;
        return { accepted: ["client@example.com"], messageId: "smtp-message-id", rejected: [] };
      },
    } as never;
  }

  protected override createImapClient() {
    const client = this.imapClients.shift();
    if (!client) throw new Error("No fake IMAP client available.");
    return client as never;
  }
}

class FakeSentImapClient extends EventEmitter {
  readonly appends: Array<{ flags?: string[]; mailbox: string; message: Buffer }> = [];
  readonly operations: string[] = [];

  constructor(
    private readonly options: {
      appendError?: Error;
      boxes: Record<string, { attribs?: string[]; children?: unknown; delimiter?: string }>;
    },
  ) {
    super();
  }

  connect() {
    this.operations.push("connect");
    setImmediate(() => this.emit("ready"));
  }

  end() {
    this.operations.push("end");
    setImmediate(() => this.emit("end"));
  }

  getBoxes(callback: (error: Error | null, boxes: unknown) => void) {
    this.operations.push("getBoxes");
    setImmediate(() => callback(null, this.options.boxes));
  }

  append(
    message: Buffer,
    options: { flags?: string[]; mailbox: string },
    callback: (error: Error | null) => void,
  ) {
    this.operations.push(`append:${options.mailbox}`);
    this.appends.push({
      ...(options.flags ? { flags: options.flags } : {}),
      mailbox: options.mailbox,
      message,
    });
    setImmediate(() => callback(this.options.appendError ?? null));
  }
}
