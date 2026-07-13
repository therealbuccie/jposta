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
    assert.equal(client.closed, false);
    assert.equal(client.socket.destroyed, true);
    assert.equal(client.loggedOut, false);
  });

  it("does not let cleanup errors replace the original IMAP error", async () => {
    const error = Object.assign(new Error("Connection not available"), { code: "NoConnection" });
    const client = new FakeImapClient({
      listError: error,
      socketDestroyError: new Error("destroy failed"),
    });
    const service = createService([client]);

    await assert.rejects(
      async () => service.listFolders(session()),
      (actual) => {
        assert.ok(actual instanceof ServiceUnavailableException);
        assert.equal((actual as Error).message, "Mail storage is temporarily unavailable.");
        return true;
      },
    );
    assert.equal(client.socketDestroyAttempted, true);
    assert.equal(client.closed, false);
    assert.equal(client.loggedOut, false);
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
    assert.equal(client.closed, false);
    assert.equal(client.loggedOut, false);
    assert.equal(client.socket.destroyed, true);
  });

  it("does not crash when connection closes during LIST", async () => {
    const client = new FakeImapClient({ emitReaderErrorDuringList: true });
    const service = createService([client]);

    await assertNoProcessCrash(() => service.listFolders(session()));
    assert.equal(client.closed, false);
    assert.equal(client.loggedOut, false);
  });

  it("does not crash when connection closes during FETCH iteration", async () => {
    const client = new FakeImapClient({ mailboxExists: 1, emitReaderErrorDuringFetch: true });
    const service = createService([client]);

    await assertNoProcessCrash(() => service.listMessages(session(), { folder: "INBOX" }));
    assert.equal(client.closed, false);
    assert.equal(client.loggedOut, false);
  });

  it("does not crash when connection closes immediately before cleanup", async () => {
    const client = new FakeImapClient({ emitReaderErrorAfterList: true });
    const service = createService([client]);

    await assertNoProcessCrash(() => service.listFolders(session()));
    assert.equal(client.closed, false);
    assert.equal(client.loggedOut, false);
  });

  it("does not crash when connection closes immediately after callback completion", async () => {
    const client = new FakeImapClient({ emitReaderErrorAfterCallback: true });
    const service = createService([client]);

    await assertNoProcessCrash(() => service.listFolders(session()), { allowSuccess: true });
    assert.equal(client.closed, false);
    assert.equal(client.loggedOut, false);
  });

  it("creates a fresh client for each folder operation", async () => {
    const first = new FakeImapClient();
    const second = new FakeImapClient();
    const service = createService([first, second]);

    await service.listFolders(session());
    await service.listFolders(session());

    assert.equal(first.connectCount, 1);
    assert.equal(second.connectCount, 1);
    assert.equal(first.closed, false);
    assert.equal(second.closed, false);
    assert.equal(first.loggedOut, false);
    assert.equal(second.loggedOut, false);
  });

  it("never calls close or logout during cleanup", async () => {
    const client = new FakeImapClient();
    const service = createService([client]);

    await service.listFolders(session());

    assert.equal(client.closed, false);
    assert.equal(client.loggedOut, false);
    assert.equal(client.socket.destroyed, true);
    assert.equal(client.socketListenersRemoved, true);
  });

  it("does not crash when socket destruction throws", async () => {
    const client = new FakeImapClient({ socketDestroyError: new Error("destroy failed") });
    const service = createService([client]);

    await assertNoProcessCrash(() => service.listFolders(session()), { allowSuccess: true });

    assert.equal(client.closed, false);
    assert.equal(client.loggedOut, false);
    assert.equal(client.socketDestroyAttempted, true);
  });

  it("treats an already-closed socket as harmless", async () => {
    const client = new FakeImapClient({ alreadyDestroyedSocket: true });
    const service = createService([client]);

    await service.listFolders(session());

    assert.equal(client.closed, false);
    assert.equal(client.loggedOut, false);
    assert.equal(client.socket.destroyed, true);
    assert.equal(client.socketDestroyAttempted, false);
  });

  it("keeps the process alive after repeated folder and message requests", async () => {
    const clients = [
      new FakeImapClient(),
      new FakeImapClient({ mailboxExists: 0 }),
      new FakeImapClient(),
      new FakeImapClient({ mailboxExists: 0 }),
    ];
    const service = createService(clients);

    await assertNoProcessCrash(
      async () => {
        await service.listFolders(session());
        await service.listMessages(session(), { folder: "INBOX" });
        await service.listFolders(session());
        await service.listMessages(session(), { folder: "INBOX" });
      },
      { allowSuccess: true },
    );

    for (const client of clients) {
      assert.equal(client.closed, false);
      assert.equal(client.loggedOut, false);
      assert.equal(client.socket.destroyed, true);
    }
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
  authenticated = false;
  mailbox: { exists: number } | false = { exists: 0 };
  connectCount = 0;
  loggedOut = false;
  closed = false;
  lockReleased = false;
  socketDestroyAttempted = false;
  socketListenersRemoved = false;
  socket = {
    destroyed: false,
    removeAllListeners: () => {
      this.socketListenersRemoved = true;
    },
    destroy: () => {
      this.socketDestroyAttempted = true;
      if (this.options.socketDestroyError) throw this.options.socketDestroyError;
      this.socket.destroyed = true;
    },
  };

  constructor(
    private readonly options: {
      alreadyDestroyedSocket?: boolean;
      connectLeavesDead?: boolean;
      emitReaderErrorAfterCallback?: boolean;
      emitReaderErrorAfterList?: boolean;
      emitReaderErrorDuringFetch?: boolean;
      emitReaderErrorDuringList?: boolean;
      listError?: Error;
      mailboxExists?: number;
      socketDestroyError?: Error;
    } = {},
  ) {
    super();
    this.mailbox = { exists: options.mailboxExists ?? 0 };
    this.socket.destroyed = Boolean(options.alreadyDestroyedSocket);
  }

  async connect() {
    this.connectCount += 1;
    this.usable = !this.options.connectLeavesDead;
    this.authenticated = this.usable;
  }

  async logout() {
    this.loggedOut = true;
    throw new Error("logout must not be called during cleanup");
  }

  close() {
    this.closed = true;
    throw new Error("close must not be called during cleanup");
  }

  async getMailboxLock() {
    return {
      release: () => {
        this.lockReleased = true;
      },
    };
  }

  async *list() {
    if (this.options.emitReaderErrorDuringList) this.emitConnectionClosed();
    if (this.options.listError) throw this.options.listError;
    yield { path: "INBOX", name: "Inbox", specialUse: "\\Inbox" };
    if (this.options.emitReaderErrorAfterList) this.emitConnectionClosed();
    if (this.options.emitReaderErrorAfterCallback) setImmediate(() => this.emitConnectionClosed());
  }

  async status() {
    return { messages: 0, unseen: 0 };
  }

  async search() {
    return [1];
  }

  async *fetch() {
    if (this.options.emitReaderErrorDuringFetch) this.emitConnectionClosed();
    yield {
      uid: 1,
      envelope: { subject: "Hello", from: [{ name: "A", mailbox: "a", host: "example.com" }] },
      flags: new Set(),
      bodyStructure: {},
    };
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

  private emitConnectionClosed() {
    this.usable = false;
    this.authenticated = false;
    this.emit("error", Object.assign(new Error("reader closed"), { code: "ConnectionClosed" }));
    this.emit("close");
  }
}
