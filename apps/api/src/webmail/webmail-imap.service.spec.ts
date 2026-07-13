import { HttpException, ServiceUnavailableException } from "@nestjs/common";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, it } from "node:test";

import { WebmailImapService } from "./webmail-imap.service";

const rawMessage = [
  "Message-ID: <msg-1@example.com>",
  "From: Alice <alice@example.com>",
  "To: Admin <admin@golivyn.com>",
  "Cc: Ops <ops@example.com>",
  "Subject: Hello launch",
  "Date: Mon, 13 Jul 2026 10:00:00 +0000",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Launch notes are ready.",
].join("\r\n");

const rawWithAttachment = [
  "Message-ID: <msg-2@example.com>",
  "From: Billing <billing@example.com>",
  "To: Admin <admin@golivyn.com>",
  "Subject: Invoice",
  "Date: Mon, 13 Jul 2026 11:00:00 +0000",
  "MIME-Version: 1.0",
  "Content-Type: multipart/mixed; boundary=abc",
  "",
  "--abc",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Invoice attached.",
  "--abc",
  "Content-Type: text/plain; name=invoice.txt",
  "Content-Disposition: attachment; filename=invoice.txt",
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from("Invoice data").toString("base64"),
  "--abc--",
].join("\r\n");

describe("WebmailImapService node-imap adapter", () => {
  it("returns folders and counts", async () => {
    const client = new FakeNodeImapClient();
    const service = createService([client]);

    const result = await service.listFolders(session());

    assert.deepEqual(
      result.folders.map((folder) => folder.path),
      ["INBOX", "Sent", "Drafts", "Trash"],
    );
    assert.equal(result.folders[0]!.total, 2);
    assert.equal(result.folders[0]!.unread, 1);
    assert.equal(client.ended, true);
  });

  it("returns an empty Inbox", async () => {
    const client = new FakeNodeImapClient({ messages: [] });
    const service = createService([client]);

    const result = await service.listMessages(session(), { folder: "INBOX" });

    assert.deepEqual(result, {
      folder: "INBOX",
      page: 1,
      pageSize: 25,
      total: 0,
      hasMore: false,
      messages: [],
    });
    assert.equal(client.ended, true);
  });

  it("lists messages and returns message detail", async () => {
    const clientA = new FakeNodeImapClient();
    const clientB = new FakeNodeImapClient();
    const service = createService([clientA, clientB]);

    const list = await service.listMessages(session(), { folder: "INBOX" });
    const detail = await service.getMessage(session(), 1, "INBOX");

    assert.equal(list.messages.length, 2);
    assert.equal((list.messages[0]! as { subject: string }).subject, "Invoice");
    assert.equal((list.messages[1]! as { unread: boolean }).unread, true);
    assert.equal(detail.subject, "Hello launch");
    assert.equal(detail.from, '"Alice" <alice@example.com>');
    assert.equal(detail.attachments.length, 0);
  });

  it("updates read and star flags", async () => {
    const first = new FakeNodeImapClient();
    const second = new FakeNodeImapClient();
    const service = createService([first, second]);

    await service.setRead(session(), 1, "INBOX", true);
    await service.setStar(session(), 1, "INBOX", false);

    assert.deepEqual(first.operations, [
      "connect",
      "openBox:INBOX:false",
      "addFlags:1:\\Seen",
      "end",
    ]);
    assert.deepEqual(second.operations, [
      "connect",
      "openBox:INBOX:false",
      "delFlags:1:\\Flagged",
      "end",
    ]);
  });

  it("moves and deletes messages", async () => {
    const first = new FakeNodeImapClient();
    const second = new FakeNodeImapClient();
    const third = new FakeNodeImapClient();
    const service = createService([first, second, third]);

    await service.move(session(), 1, "INBOX", "Archive");
    await service.delete(session(), 1, "INBOX");
    await service.delete(session(), 1, "Trash");

    assert.ok(first.operations.includes("move:1:Archive"));
    assert.ok(second.operations.includes("move:1:Trash"));
    assert.ok(third.operations.includes("addFlags:1:\\Deleted"));
    assert.ok(third.operations.includes("expunge:1"));
  });

  it("saves, updates, and deletes drafts", async () => {
    const first = new FakeNodeImapClient();
    const second = new FakeNodeImapClient();
    const third = new FakeNodeImapClient();
    const service = createService([first, second, third]);

    const created = await service.saveDraft(session(), rawMessage);
    await service.saveDraft(session(), rawMessage, 3);
    await service.deleteDraft(session(), 3);

    assert.deepEqual(created, { uid: 0 });
    assert.ok(first.operations.includes("append:Drafts"));
    assert.ok(second.operations.includes("addFlags:3:\\Deleted"));
    assert.ok(second.operations.includes("append:Drafts"));
    assert.ok(third.operations.includes("addFlags:3:\\Deleted"));
  });

  it("returns attachment content", async () => {
    const client = new FakeNodeImapClient();
    const service = createService([client]);

    const attachment = await service.getAttachment(session(), 2, "0", "INBOX");

    assert.equal(attachment.filename, "invoice.txt");
    assert.equal(attachment.content.toString(), "Invoice data");
  });

  it("converts authentication failure to a controlled exception", async () => {
    const client = new FakeNodeImapClient({
      connectError: Object.assign(new Error("AUTHENTICATIONFAILED"), { code: "AUTH" }),
    });
    const service = createService([client]);

    await assert.rejects(
      () => service.listFolders(session()),
      (error) => {
        assert.ok(error instanceof HttpException);
        assert.equal((error as HttpException).getStatus(), 401);
        return true;
      },
    );
  });

  it("converts network timeout to a controlled exception", async () => {
    const client = new FakeNodeImapClient({
      connectError: Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }),
    });
    const service = createService([client]);

    await assert.rejects(() => service.listFolders(session()), ServiceUnavailableException);
  });

  it("handles connection close during fetch without process crash", async () => {
    const client = new FakeNodeImapClient({ closeDuringFetch: true });
    const service = createService([client]);

    await assertNoProcessCrash(() => service.listMessages(session(), { folder: "INBOX" }));
    assert.equal(client.ended, true);
  });

  it("keeps process alive across repeated requests", async () => {
    const clients = [new FakeNodeImapClient(), new FakeNodeImapClient(), new FakeNodeImapClient()];
    const service = createService(clients);

    await assertNoProcessCrash(
      async () => {
        await service.listFolders(session());
        await service.listMessages(session(), { folder: "INBOX" });
        await service.getMessage(session(), 1, "INBOX");
      },
      { allowSuccess: true },
    );

    for (const client of clients) assert.equal(client.ended, true);
  });
});

async function assertNoProcessCrash(
  operation: () => Promise<unknown>,
  options: { allowSuccess?: boolean } = {},
) {
  const crashes: unknown[] = [];
  const uncaught = (error: unknown) => crashes.push(error);
  const unhandled = (reason: unknown) => crashes.push(reason);
  process.once("uncaughtException", uncaught);
  process.once("unhandledRejection", unhandled);
  try {
    await operation().catch((error) => {
      if (options.allowSuccess) throw error;
      assert.ok(error instanceof ServiceUnavailableException);
    });
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    process.removeListener("uncaughtException", uncaught);
    process.removeListener("unhandledRejection", unhandled);
  }
  assert.deepEqual(crashes, []);
}

function createService(clients: FakeNodeImapClient[]) {
  class TestWebmailImapService extends WebmailImapService {
    protected override createImapClient() {
      const client = clients.shift();
      if (!client) throw new Error("No fake IMAP client available.");
      return client as never;
    }
  }

  return new TestWebmailImapService();
}

function session() {
  return {
    mailbox: { address: "admin@golivyn.com" },
    credential: "Password2323@",
  } as never;
}

type FakeMessage = {
  uid: number;
  flags: string[];
  raw: string;
};

class FakeNodeImapClient extends EventEmitter {
  operations: string[] = [];
  ended = false;
  private readonly messages: FakeMessage[];

  constructor(
    private readonly options: {
      closeDuringFetch?: boolean;
      connectError?: Error;
      messages?: FakeMessage[];
    } = {},
  ) {
    super();
    this.messages = options.messages ?? [
      { uid: 1, flags: [], raw: rawMessage },
      { uid: 2, flags: ["\\Seen", "\\Flagged"], raw: rawWithAttachment },
    ];
  }

  connect() {
    this.operations.push("connect");
    setImmediate(() => {
      if (this.options.connectError) this.emit("error", this.options.connectError);
      else this.emit("ready");
    });
  }

  end() {
    this.operations.push("end");
    this.ended = true;
    setImmediate(() => this.emit("end"));
  }

  openBox(name: string, readOnly: boolean, callback: (error: Error | null, box: unknown) => void) {
    this.operations.push(`openBox:${name}:${readOnly}`);
    setImmediate(() =>
      callback(null, { name, messages: { total: this.messages.length, unseen: 1 } }),
    );
  }

  getBoxes(callback: (error: Error | null, boxes: unknown) => void) {
    this.operations.push("getBoxes");
    setImmediate(() =>
      callback(null, {
        INBOX: { attribs: ["\\Inbox"], delimiter: "/", children: null },
        Sent: { attribs: ["\\Sent"], delimiter: "/", children: null },
        Drafts: { attribs: ["\\Drafts"], delimiter: "/", children: null },
        Trash: { attribs: ["\\Trash"], delimiter: "/", children: null },
      }),
    );
  }

  status(name: string, callback: (error: Error | null, box: unknown) => void) {
    this.operations.push(`status:${name}`);
    setImmediate(() =>
      callback(null, {
        messages: {
          total: name === "INBOX" ? this.messages.length : 0,
          unseen: name === "INBOX" ? 1 : 0,
        },
      }),
    );
  }

  search(criteria: unknown[], callback: (error: Error | null, uids: number[]) => void) {
    this.operations.push(`search:${criteria.join("|")}`);
    let messages = this.messages;
    if (criteria.includes("UNSEEN"))
      messages = messages.filter((message) => !message.flags.includes("\\Seen"));
    if (criteria.includes("FLAGGED"))
      messages = messages.filter((message) => message.flags.includes("\\Flagged"));
    setImmediate(() =>
      callback(
        null,
        messages.map((message) => message.uid),
      ),
    );
  }

  fetch(uids: number[]) {
    this.operations.push(`fetch:${uids.join(",")}`);
    const fetcher = new EventEmitter();
    setImmediate(() => {
      if (this.options.closeDuringFetch) {
        this.emit("close", true);
        fetcher.emit(
          "error",
          Object.assign(new Error("connection closed during fetch"), { code: "ConnectionClosed" }),
        );
        return;
      }

      for (const uid of uids) {
        const data = this.messages.find((message) => message.uid === uid);
        if (!data) continue;
        const message = new EventEmitter();
        fetcher.emit("message", message, uid);
        setImmediate(() => {
          message.emit("body", Readable.from([Buffer.from(data.raw)]), { which: "" });
          message.emit("attributes", { uid: data.uid, flags: data.flags, struct: [] });
          message.emit("end");
        });
      }
      setImmediate(() => fetcher.emit("end"));
    });
    return fetcher;
  }

  addFlags(uid: number, flag: string, callback: (error: Error | null) => void) {
    this.operations.push(`addFlags:${uid}:${flag}`);
    setImmediate(() => callback(null));
  }

  delFlags(uid: number, flag: string, callback: (error: Error | null) => void) {
    this.operations.push(`delFlags:${uid}:${flag}`);
    setImmediate(() => callback(null));
  }

  move(uid: number, destination: string, callback: (error: Error | null) => void) {
    this.operations.push(`move:${uid}:${destination}`);
    setImmediate(() => callback(null));
  }

  append(_message: string, options: { mailbox?: string }, callback: (error: Error | null) => void) {
    this.operations.push(`append:${options.mailbox}`);
    setImmediate(() => callback(null));
  }

  expunge(uid: number, callback: (error: Error | null) => void) {
    this.operations.push(`expunge:${uid}`);
    setImmediate(() => callback(null));
  }
}
