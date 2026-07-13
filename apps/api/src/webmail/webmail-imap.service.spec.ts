import { ServiceUnavailableException } from "@nestjs/common";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";

import { WebmailImapService } from "./webmail-imap.service";

describe("WebmailImapService connection safety", () => {
  it("sets disableAutoIdle for short-lived REST IMAP clients", () => {
    class ExposedWebmailImapService extends WebmailImapService {
      create() {
        return this.createImapClient("admin@golivyn.com", "Password2323@", 12000) as never as {
          options?: { disableAutoIdle?: boolean };
        };
      }
    }

    const client = new ExposedWebmailImapService().create();

    assert.equal(client.options?.disableAutoIdle, true);
  });

  it("returns a controlled error for a dead connection and destroys only the socket", async () => {
    const client = new FakeImapClient({ connectLeavesDead: true });
    const service = createService([client]);

    await assert.rejects(() => service.listFolders(session()), ServiceUnavailableException);
    assert.equal(client.socket.destroyed, true);
    assert.equal(client.loggedOut, false);
    assert.equal(client.closed, false);
    assert.deepEqual(client.operations, ["connect", "socket.destroy"]);
  });

  it("does not let socket destruction errors replace the original IMAP error", async () => {
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
    assert.equal(client.loggedOut, false);
    assert.equal(client.closed, false);
  });

  it("returns zero counts for an empty inbox without crashing", async () => {
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
    assert.equal(client.socket.destroyed, false);
    assert.deepEqual(client.operations, [
      "connect",
      "getMailboxLock:INBOX",
      "lock.release",
      "logout",
    ]);
  });

  it("folder listing completes with healthy logout and no socket destroy", async () => {
    const client = new FakeImapClient();
    const service = createService([client]);

    const result = await service.listFolders(session());

    assert.equal(result.folders.length, 1);
    assert.equal(client.loggedOut, true);
    assert.equal(client.socket.destroyed, false);
    assert.deepEqual(client.operations, ["connect", "list", "status", "logout"]);
  });

  it("releases mailbox locks before any cleanup action", async () => {
    const client = new FakeImapClient({ mailboxExists: 0 });
    const service = createService([client]);

    await service.listMessages(session(), { folder: "INBOX" });

    assert.ok(client.operations.indexOf("lock.release") > -1);
    assert.ok(client.operations.indexOf("logout") > client.operations.indexOf("lock.release"));
    assert.equal(client.commandAfterSocketDestroy, false);
  });

  it("does not execute commands after socket destruction", async () => {
    const client = new FakeImapClient({ connectLeavesDead: true });
    const service = createService([client]);

    await assert.rejects(
      () => service.listMessages(session(), { folder: "INBOX" }),
      ServiceUnavailableException,
    );

    assert.equal(client.socket.destroyed, true);
    assert.equal(client.commandAfterSocketDestroy, false);
    assert.equal(client.loggedOut, false);
  });

  it("does not crash when connection closes during LIST", async () => {
    const client = new FakeImapClient({ emitReaderErrorDuringList: true });
    const service = createService([client]);

    await assertNoProcessCrash(() => service.listFolders(session()));
    assert.equal(client.loggedOut, false);
    assert.equal(client.socket.destroyed, true);
  });

  it("does not crash when connection closes during FETCH iteration", async () => {
    const client = new FakeImapClient({ mailboxExists: 1, emitReaderErrorDuringFetch: true });
    const service = createService([client]);

    await assertNoProcessCrash(() => service.listMessages(session(), { folder: "INBOX" }));
    assert.equal(client.loggedOut, false);
    assert.equal(client.socket.destroyed, true);
  });

  it("does not crash when connection closes immediately before cleanup", async () => {
    const client = new FakeImapClient({ emitReaderErrorAfterList: true });
    const service = createService([client]);

    await assertNoProcessCrash(() => service.listFolders(session()));
    assert.equal(client.loggedOut, false);
    assert.equal(client.socket.destroyed, true);
  });

  it("does not turn delayed NoConnection into an unhandled rejection", async () => {
    const client = new FakeImapClient({ emitReaderErrorAfterCallback: true });
    const service = createService([client]);

    await assertNoProcessCrash(() => service.listFolders(session()), { allowSuccess: true });
  });

  it("treats an already-dead connection as socket-only cleanup", async () => {
    const client = new FakeImapClient({ alreadyDestroyedSocket: true });
    const service = createService([client]);

    await assert.rejects(
      () => service.listMessages(session(), { folder: "INBOX" }),
      ServiceUnavailableException,
    );

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
      assert.equal(client.loggedOut, true);
      assert.equal(client.commandAfterSocketDestroy, false);
    }
  });

  it("performs healthy connection cleanup with logout", async () => {
    const client = new FakeImapClient({ mailboxExists: 0 });
    const service = createService([client]);

    await service.listMessages(session(), { folder: "INBOX" });

    assert.equal(client.lockReleased, true);
    assert.equal(client.loggedOut, true);
    assert.equal(client.socket.destroyed, false);
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
  commandAfterSocketDestroy = false;
  idleStartTimer: NodeJS.Timeout | false = setTimeout(() => undefined, 60000);
  operations: string[] = [];
  socket = {
    destroyed: false,
    destroy: () => {
      this.operations.push("socket.destroy");
      this.socketDestroyAttempted = true;
      if (this.options.socketDestroyError) throw this.options.socketDestroyError;
      this.socket.destroyed = true;
      this.usable = false;
      this.authenticated = false;
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
    this.operations.push("connect");
    this.connectCount += 1;
    this.usable = !this.options.connectLeavesDead && !this.socket.destroyed;
    this.authenticated = this.usable;
  }

  async logout() {
    this.assertSocketOpen("logout");
    this.operations.push("logout");
    this.loggedOut = true;
    this.usable = false;
    this.authenticated = false;
  }

  close() {
    this.closed = true;
    throw new Error("close must not be called during cleanup");
  }

  async getMailboxLock(path: string) {
    this.assertSocketOpen(`getMailboxLock:${path}`);
    this.operations.push(`getMailboxLock:${path}`);
    return {
      release: async () => {
        this.operations.push("lock.release");
        this.lockReleased = true;
        await new Promise((resolve) => setImmediate(resolve));
        this.assertSocketOpen("lock.release.settled");
      },
    };
  }

  async *list() {
    this.assertSocketOpen("list");
    this.operations.push("list");
    if (this.options.emitReaderErrorDuringList) this.emitConnectionClosed();
    if (this.options.listError) throw this.options.listError;
    yield { path: "INBOX", name: "Inbox", specialUse: "\\Inbox" };
    if (this.options.emitReaderErrorAfterList) this.emitConnectionClosed();
    if (this.options.emitReaderErrorAfterCallback) setImmediate(() => this.emitConnectionClosed());
  }

  async status() {
    this.assertSocketOpen("status");
    this.operations.push("status");
    return { messages: 0, unseen: 0 };
  }

  async search() {
    this.assertSocketOpen("search");
    this.operations.push("search");
    return [1];
  }

  async *fetch() {
    this.assertSocketOpen("fetch");
    this.operations.push("fetch");
    if (this.options.emitReaderErrorDuringFetch) this.emitConnectionClosed();
    yield {
      uid: 1,
      envelope: { subject: "Hello", from: [{ name: "A", mailbox: "a", host: "example.com" }] },
      flags: new Set(),
      bodyStructure: {},
    };
  }

  async fetchOne() {
    this.assertSocketOpen("fetchOne");
    this.operations.push("fetchOne");
    return false;
  }

  async messageMove() {
    this.assertSocketOpen("messageMove");
    this.operations.push("messageMove");
    return undefined;
  }

  async messageDelete() {
    this.assertSocketOpen("messageDelete");
    this.operations.push("messageDelete");
    return undefined;
  }

  async messageFlagsAdd() {
    this.assertSocketOpen("messageFlagsAdd");
    this.operations.push("messageFlagsAdd");
    return undefined;
  }

  async messageFlagsRemove() {
    this.assertSocketOpen("messageFlagsRemove");
    this.operations.push("messageFlagsRemove");
    return undefined;
  }

  async append() {
    this.assertSocketOpen("append");
    this.operations.push("append");
    return { uid: 1 };
  }

  private assertSocketOpen(command: string) {
    if (this.socket.destroyed) {
      this.commandAfterSocketDestroy = true;
      const error = Object.assign(new Error(`Command ${command} after socket destroy`), {
        code: "NoConnection",
      });
      throw error;
    }
  }

  private emitConnectionClosed() {
    this.usable = false;
    this.authenticated = false;
    this.emit("error", Object.assign(new Error("reader closed"), { code: "ConnectionClosed" }));
    this.emit("close");
  }
}
