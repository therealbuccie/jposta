import { ServiceUnavailableException } from "@nestjs/common";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";

import { WebmailImapService } from "./webmail-imap.service";

describe("WebmailImapService connection safety", () => {
  it("returns a controlled error for a dead connection", async () => {
    const client = new FakeImapClient({ connectLeavesDead: true });
    const service = createService([client]);

    await assert.rejects(() => service.listFolders(session()), ServiceUnavailableException);
    assert.equal(client.destroyed, true);
  });

  it("does not let cleanup errors replace the original IMAP error", async () => {
    const error = Object.assign(new Error("Connection not available"), { code: "NoConnection" });
    const client = new FakeImapClient({ listError: error, logoutError: new Error("logout failed") });
    const service = createService([client]);

    await assert.rejects(async () => service.listFolders(session()), (actual) => {
      assert.ok(actual instanceof ServiceUnavailableException);
      assert.equal((actual as Error).message, "Mail storage is temporarily unavailable.");
      return true;
    });
    assert.equal(client.destroyed, true);
  });

  it("returns zero counts for an empty inbox", async () => {
    const client = new FakeImapClient({ mailboxExists: 0 });
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
    assert.equal(client.lockReleased, true);
    assert.equal(client.loggedOut, true);
  });

  it("consumes emitted reader errors so the API process does not exit", async () => {
    const client = new FakeImapClient({ emitReaderErrorDuringList: true });
    const service = createService([client]);

    await assert.doesNotReject(() => service.listFolders(session()));
    assert.equal(client.loggedOut, true);
  });

  it("creates a fresh client for each folder operation", async () => {
    const first = new FakeImapClient();
    const second = new FakeImapClient();
    const service = createService([first, second]);

    await service.listFolders(session());
    await service.listFolders(session());

    assert.equal(first.connectCount, 1);
    assert.equal(second.connectCount, 1);
    assert.equal(first.loggedOut, true);
    assert.equal(second.loggedOut, true);
  });
});

function createService(clients: FakeImapClient[]) {
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

class FakeImapClient extends EventEmitter {
  usable = false;
  mailbox: { exists: number } | false = { exists: 0 };
  connectCount = 0;
  loggedOut = false;
  closed = false;
  destroyed = false;
  lockReleased = false;

  constructor(
    private readonly options: {
      connectLeavesDead?: boolean;
      emitReaderErrorDuringList?: boolean;
      listError?: Error;
      logoutError?: Error;
      mailboxExists?: number;
    } = {},
  ) {
    super();
    this.mailbox = { exists: options.mailboxExists ?? 0 };
  }

  async connect() {
    this.connectCount += 1;
    this.usable = !this.options.connectLeavesDead;
  }

  async logout() {
    this.loggedOut = true;
    if (this.options.logoutError) throw this.options.logoutError;
    this.usable = false;
  }

  close() {
    this.closed = true;
    this.usable = false;
  }

  destroy() {
    this.destroyed = true;
    this.usable = false;
  }

  async getMailboxLock() {
    return {
      release: () => {
        this.lockReleased = true;
      },
    };
  }

  async *list() {
    if (this.options.emitReaderErrorDuringList) {
      this.emit("error", Object.assign(new Error("reader closed"), { code: "ConnectionClosed" }));
    }
    if (this.options.listError) throw this.options.listError;
    yield { path: "INBOX", name: "Inbox", specialUse: "\\Inbox" };
  }

  async status() {
    return { messages: 0, unseen: 0 };
  }

  async search() {
    return [];
  }

  async *fetch() {
    return;
  }

  async fetchOne() {
    return false;
  }

  async messageMove() {
    return undefined;
  }

  async messageDelete() {
    return undefined;
  }

  async messageFlagsAdd() {
    return undefined;
  }

  async messageFlagsRemove() {
    return undefined;
  }

  async append() {
    return { uid: 1 };
  }
}
