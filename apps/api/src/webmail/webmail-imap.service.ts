import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { EventEmitter } from "node:events";
import type { Readable } from "node:stream";
import { simpleParser } from "mailparser";

import type { WebmailSessionService } from "./webmail-session.service";
import {
  normalizeFolderPath,
  normalizePage,
  normalizePageSize,
  sanitizeEmailHtml,
  sanitizeFilename,
} from "./webmail.utils";

const NodeImap = require("node-imap") as new (config: Record<string, unknown>) => ImapClient;

const defaultOperationTimeoutMs = 12000;

type WebmailSession = Awaited<ReturnType<WebmailSessionService["getSession"]>>;

type ListMessagesInput = {
  folder?: string;
  page?: unknown;
  pageSize?: unknown;
  search?: string;
  starredOnly?: unknown;
  unreadOnly?: unknown;
};

type MailboxConnectionOptions = {
  folder?: string;
  readOnly?: boolean;
  timeoutMs?: number;
};

type FolderInfo = {
  name: string;
  path: string;
  specialUse?: string;
  total: number;
  unread: number;
};

type ParsedFetchedMessage = {
  uid: number;
  flags: string[];
  raw: Buffer;
  struct?: unknown;
};

type ImapClient = EventEmitter & {
  connect: () => void;
  end: () => void;
  destroy?: () => void;
  state?: string;
  openBox: (
    name: string,
    readOnly: boolean,
    callback: (error: Error | null, box: ImapBox) => void,
  ) => void;
  getBoxes: (callback: (error: Error | null, boxes: ImapBoxes) => void) => void;
  status: (name: string, callback: (error: Error | null, box: ImapBox) => void) => void;
  search: (criteria: unknown[], callback: (error: Error | null, uids: number[]) => void) => void;
  fetch: (source: unknown, options: Record<string, unknown>) => ImapFetch;
  addFlags: (source: unknown, flags: unknown, callback: (error: Error | null) => void) => void;
  delFlags: (source: unknown, flags: unknown, callback: (error: Error | null) => void) => void;
  move: (source: unknown, destination: string, callback: (error: Error | null) => void) => void;
  append: (
    message: string | Buffer,
    options: Record<string, unknown>,
    callback: (error: Error | null) => void,
  ) => void;
  expunge: (sourceOrCallback: unknown, callback?: (error: Error | null) => void) => void;
};

type ImapFetch = EventEmitter;

type ImapMessage = EventEmitter;

type ImapBox = {
  name?: string;
  messages?: { total?: number; unseen?: number; new?: number };
};

type ImapBoxes = Record<
  string,
  {
    attribs?: string[];
    delimiter?: string;
    children?: ImapBoxes | null;
  }
>;

@Injectable()
export class WebmailImapService {
  async listFolders(session: WebmailSession) {
    return this.withConnection(session.mailbox.address, session.credential, async (client) => {
      const boxes = await withTimeout(getBoxes(client), defaultOperationTimeoutMs, "LIST");
      const flattened = flattenBoxes(boxes);
      const folders = await Promise.all(
        flattened.map(async (folder) => {
          const status = await withTimeout(
            callback<ImapBox>((done) => client.status(folder.path, done)),
            defaultOperationTimeoutMs,
            `STATUS ${folder.path}`,
          ).catch(() => ({ messages: { total: 0, unseen: 0 } }) as ImapBox);

          return {
            path: folder.path,
            name: folder.name,
            ...(folder.specialUse ? { specialUse: folder.specialUse } : {}),
            total: Number(status.messages?.total || 0),
            unread: Number(status.messages?.unseen || 0),
          } satisfies FolderInfo;
        }),
      );

      return {
        folders: folders.sort(
          (a, b) => folderRank(a) - folderRank(b) || a.name.localeCompare(b.name),
        ),
      };
    });
  }

  async listMessages(session: WebmailSession, input: ListMessagesInput) {
    const folder = normalizeFolderPath(input.folder);
    const page = normalizePage(input.page);
    const pageSize = normalizePageSize(input.pageSize);

    return this.withConnection(
      session.mailbox.address,
      session.credential,
      async (client, box) => {
        const total = Number(box?.messages?.total || 0);
        if (!total) return { folder, page, pageSize, total: 0, hasMore: false, messages: [] };

        const criteria = buildSearchCriteria(input);
        const uids = await withTimeout(
          search(client, criteria),
          defaultOperationTimeoutMs,
          "SEARCH",
        );
        const sorted = [...uids].sort((a, b) => b - a);
        const pageUids = sorted.slice((page - 1) * pageSize, page * pageSize);
        const fetched = await fetchMessages(client, pageUids, { bodies: "", struct: true });
        const messages = await Promise.all(fetched.map(toListMessage));

        return {
          folder,
          page,
          pageSize,
          total: criteria.length === 1 && criteria[0] === "ALL" ? total : sorted.length,
          hasMore:
            page * pageSize <
            (criteria.length === 1 && criteria[0] === "ALL" ? total : sorted.length),
          messages: messages.sort((a, b) => Number(b.uid || 0) - Number(a.uid || 0)),
        };
      },
      { folder, readOnly: true },
    );
  }

  async getMessage(session: WebmailSession, uid: number, folderValue?: string) {
    const folder = normalizeFolderPath(folderValue);
    return this.withConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        const fetched = await fetchOneMessage(client, uid, { bodies: "", struct: true });
        if (!fetched?.raw) throw new NotFoundException("Message not found.");
        return toDetailMessage(fetched);
      },
      { folder, readOnly: true },
    );
  }

  async setRead(
    session: WebmailSession,
    uid: number,
    folderValue: string | undefined,
    read: boolean,
  ) {
    return this.updateFlag(session, uid, folderValue, "\\Seen", read);
  }

  async setStar(
    session: WebmailSession,
    uid: number,
    folderValue: string | undefined,
    starred: boolean,
  ) {
    return this.updateFlag(session, uid, folderValue, "\\Flagged", starred);
  }

  async move(
    session: WebmailSession,
    uid: number,
    fromFolderValue: string | undefined,
    toFolderValue: string | undefined,
  ) {
    const fromFolder = normalizeFolderPath(fromFolderValue);
    const toFolder = normalizeFolderPath(toFolderValue);
    return this.withConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        await withTimeout(
          callback<void>((done) => client.move(uid, toFolder, done)),
          defaultOperationTimeoutMs,
          "MOVE",
        );
        return { moved: true, fromFolder, toFolder, uid };
      },
      { folder: fromFolder, readOnly: false },
    );
  }

  async delete(session: WebmailSession, uid: number, folderValue?: string) {
    const folder = normalizeFolderPath(folderValue);
    const isTrash = /trash|deleted/i.test(folder);
    if (!isTrash) return this.move(session, uid, folder, "Trash");

    return this.withConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        await withTimeout(
          callback<void>((done) => client.addFlags(uid, "\\Deleted", done)),
          defaultOperationTimeoutMs,
          "STORE",
        );
        await withTimeout(expunge(client, uid), defaultOperationTimeoutMs, "EXPUNGE");
        return { deleted: true, permanent: true, uid };
      },
      { folder, readOnly: false },
    );
  }

  async saveDraft(session: WebmailSession, rawMessage: string, uid?: number) {
    return this.withConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        if (uid) {
          await callback<void>((done) => client.addFlags(uid, "\\Deleted", done)).catch(() => null);
          await expunge(client, uid).catch(() => null);
        }

        await withTimeout(
          callback<void>((done) =>
            client.append(rawMessage, { mailbox: "Drafts", flags: ["\\Draft"] }, done),
          ),
          defaultOperationTimeoutMs,
          "APPEND",
        );
        return { uid: 0 };
      },
      { folder: "Drafts", readOnly: false },
    );
  }

  async deleteDraft(session: WebmailSession, uid: number) {
    return this.withConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        await withTimeout(
          callback<void>((done) => client.addFlags(uid, "\\Deleted", done)),
          defaultOperationTimeoutMs,
          "STORE",
        );
        await withTimeout(expunge(client, uid), defaultOperationTimeoutMs, "EXPUNGE");
        return { deleted: true, permanent: true, uid };
      },
      { folder: "Drafts", readOnly: false },
    );
  }

  async getAttachment(session: WebmailSession, uid: number, partId: string, folderValue?: string) {
    const folder = normalizeFolderPath(folderValue);
    return this.withConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        const fetched = await fetchOneMessage(client, uid, { bodies: "" });
        if (!fetched?.raw) throw new NotFoundException("Message not found.");
        const parsed = await simpleParser(fetched.raw);
        const index = Number(partId);
        const attachment = Number.isInteger(index) ? parsed.attachments[index] : undefined;
        if (!attachment) throw new NotFoundException("Attachment not found.");
        return {
          content: attachment.content,
          contentType: attachment.contentType || "application/octet-stream",
          filename: sanitizeFilename(attachment.filename, `attachment-${index + 1}`),
          size: attachment.size,
        };
      },
      { folder, readOnly: true },
    );
  }

  async health() {
    return this.withConnection("healthcheck", "healthcheck", async () => true, {
      timeoutMs: 3000,
    }).catch(() => false);
  }

  protected createImapClient(mailbox: string, password: string, timeoutMs: number) {
    const host = process.env.IMAP_HOST || process.env.WEBMAIL_IMAP_HOST || "jposta-mailserver";
    const port = Number.parseInt(
      process.env.IMAP_PORT || process.env.WEBMAIL_IMAP_PORT || "993",
      10,
    );
    const secure =
      (process.env.IMAP_SECURE || process.env.WEBMAIL_IMAP_SECURE || "true") !== "false";

    return new NodeImap({
      user: mailbox,
      password,
      host,
      port: Number.isInteger(port) ? port : 993,
      tls: secure,
      tlsOptions: {
        servername:
          process.env.IMAP_TLS_SERVERNAME ||
          process.env.WEBMAIL_IMAP_SERVERNAME ||
          process.env.IMAP_SERVERNAME ||
          "mail.jposta.com",
        rejectUnauthorized: process.env.WEBMAIL_IMAP_REJECT_UNAUTHORIZED !== "false",
      },
      connTimeout: timeoutMs,
      authTimeout: timeoutMs,
      keepalive: false,
    }) as ImapClient;
  }

  private async updateFlag(
    session: WebmailSession,
    uid: number,
    folderValue: string | undefined,
    flag: string,
    enabled: boolean,
  ) {
    const folder = normalizeFolderPath(folderValue);
    return this.withConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        await withTimeout(
          callback<void>((done) => {
            if (enabled) client.addFlags(uid, flag, done);
            else client.delFlags(uid, flag, done);
          }),
          defaultOperationTimeoutMs,
          "STORE",
        );
        return { uid, folder, updated: true };
      },
      { folder, readOnly: false },
    );
  }

  private async withConnection<T>(
    mailbox: string,
    password: string,
    callbackFn: (client: ImapClient, box?: ImapBox) => Promise<T>,
    options: MailboxConnectionOptions = {},
  ) {
    const timeoutMs = options.timeoutMs ?? defaultOperationTimeoutMs;
    const client = this.createImapClient(mailbox, password, timeoutMs);
    const errors: unknown[] = [];
    let ended = false;

    const onError = (error: unknown) => {
      errors.push(error);
      console.error("Webmail node-imap client error", summarizeImapError(error));
    };
    const onClose = (hadError?: boolean) => {
      if (hadError) console.warn("Webmail node-imap client closed after error");
    };
    const onEnd = () => {
      ended = true;
    };

    client.on("error", onError);
    client.on("close", onClose);
    client.on("end", onEnd);

    try {
      await withTimeout(waitForReady(client), timeoutMs, "CONNECT");
      const box = options.folder
        ? await withTimeout(
            openBox(client, options.folder, options.readOnly ?? true),
            timeoutMs,
            "SELECT",
          )
        : undefined;
      return await withTimeout(callbackFn(client, box), timeoutMs, "OPERATION");
    } catch (error) {
      throw toWebmailHttpException(error);
    } finally {
      await safeEndClient(client, timeoutMs, () => ended).catch((error) => {
        console.warn("Webmail node-imap cleanup failed", summarizeImapError(error));
      });
      client.removeListener("error", onError);
      client.removeListener("close", onClose);
      client.removeListener("end", onEnd);
      if (errors.length) {
        console.info("Webmail node-imap consumed connection errors", { count: errors.length });
      }
    }
  }
}

function waitForReady(client: ImapClient) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      client.removeListener("ready", onReady);
      client.removeListener("error", onError);
      client.removeListener("close", onClose);
      client.removeListener("end", onEnd);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (error: unknown) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(connectionClosedError());
    };
    const onEnd = () => {
      cleanup();
      reject(connectionClosedError());
    };

    client.once("ready", onReady);
    client.once("error", onError);
    client.once("close", onClose);
    client.once("end", onEnd);
    client.connect();
  });
}

function openBox(client: ImapClient, folder: string, readOnly: boolean) {
  return callback<ImapBox>((done) => client.openBox(folder, readOnly, done));
}

function getBoxes(client: ImapClient) {
  return callback<ImapBoxes>((done) => client.getBoxes(done));
}

function search(client: ImapClient, criteria: unknown[]) {
  return callback<number[]>((done) => client.search(criteria, done));
}

function expunge(client: ImapClient, uid: number) {
  return callback<void>((done) => client.expunge(uid, done));
}

function callback<T>(start: (done: (error: Error | null, result: T) => void) => void) {
  return new Promise<T>((resolve, reject) => {
    start((error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

async function fetchOneMessage(client: ImapClient, uid: number, options: Record<string, unknown>) {
  const messages = await fetchMessages(client, [uid], options);
  return messages[0];
}

function fetchMessages(
  client: ImapClient,
  uids: number[],
  options: Record<string, unknown>,
): Promise<ParsedFetchedMessage[]> {
  if (!uids.length) return Promise.resolve([]);

  return new Promise((resolve, reject) => {
    const messages = new Map<number, Partial<ParsedFetchedMessage>>();
    let settled = false;

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      if (error) {
        reject(error);
        return;
      }
      resolve(
        [...messages.values()]
          .filter((message): message is ParsedFetchedMessage => Boolean(message.uid && message.raw))
          .sort((a, b) => b.uid - a.uid),
      );
    };

    let fetcher: ImapFetch;
    try {
      fetcher = client.fetch(uids, { markSeen: false, ...options });
    } catch (error) {
      finish(error);
      return;
    }

    fetcher.on("message", (message: ImapMessage, seqno: number) => {
      const record: Partial<ParsedFetchedMessage> = { uid: 0, flags: [], raw: Buffer.alloc(0) };
      messages.set(seqno, record);
      const bodyChunks: Buffer[] = [];
      const bodyPromises: Array<Promise<void>> = [];

      message.on("body", (stream: Readable) => {
        bodyPromises.push(
          streamToBuffer(stream).then((buffer) => {
            bodyChunks.push(buffer);
          }),
        );
      });

      message.once("attributes", (attrs: { uid?: number; flags?: string[]; struct?: unknown }) => {
        record.uid = Number(attrs.uid || 0);
        record.flags = attrs.flags || [];
        record.struct = attrs.struct;
      });

      message.once("error", finish);
      message.once("end", () => {
        Promise.all(bodyPromises)
          .then(() => {
            record.raw = Buffer.concat(bodyChunks);
          })
          .catch(finish);
      });
    });

    fetcher.once("error", finish);
    fetcher.once("end", () => {
      setImmediate(() => finish());
    });
  });
}

function streamToBuffer(stream: Readable) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.once("error", reject);
    stream.once("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function safeEndClient(client: ImapClient, timeoutMs: number, isEnded: () => boolean) {
  if (isEnded()) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.removeListener("end", done);
      client.removeListener("close", done);
      resolve();
    };
    const timer = setTimeout(done, Math.min(timeoutMs, 3000));
    client.once("end", done);
    client.once("close", done);
    try {
      client.end();
    } catch {
      done();
    }
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`IMAP ${operation} timed out.`);
      (error as Error & { code?: string }).code = "Timeout";
      reject(error);
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function buildSearchCriteria(input: ListMessagesInput) {
  if (input.search)
    return ["OR", ["BODY", String(input.search)], ["SUBJECT", String(input.search)]];
  if (input.unreadOnly === "true" || input.unreadOnly === true) return ["UNSEEN"];
  if (input.starredOnly === "true" || input.starredOnly === true) return ["FLAGGED"];
  return ["ALL"];
}

function flattenBoxes(boxes: ImapBoxes, parentPath = "") {
  const result: Array<{ name: string; path: string; specialUse?: string }> = [];
  for (const [name, box] of Object.entries(boxes || {})) {
    const delimiter = box.delimiter || "/";
    const path = parentPath ? `${parentPath}${delimiter}${name}` : name;
    const attribs = box.attribs || [];
    if (!attribs.some((attribute) => /NOSELECT/i.test(attribute))) {
      const specialUse = specialUseFromAttributes(name, attribs);
      result.push({ name, path, ...(specialUse ? { specialUse } : {}) });
    }
    if (box.children) result.push(...flattenBoxes(box.children, path));
  }
  return result;
}

function specialUseFromAttributes(name: string, attributes: string[]) {
  const value = `${name} ${attributes.join(" ")}`.toLowerCase();
  if (value.includes("inbox")) return "\\Inbox";
  if (value.includes("sent")) return "\\Sent";
  if (value.includes("draft")) return "\\Drafts";
  if (value.includes("trash") || value.includes("deleted")) return "\\Trash";
  if (value.includes("junk") || value.includes("spam")) return "\\Junk";
  if (value.includes("archive")) return "\\Archive";
  return undefined;
}

async function toListMessage(message: ParsedFetchedMessage) {
  const parsed = await simpleParser(message.raw);
  return {
    uid: message.uid,
    messageId: parsed.messageId || "",
    from: addressText(parsed.from),
    to: addressText(parsed.to),
    subject: parsed.subject || "(No subject)",
    preview: parsed.text?.replace(/\s+/g, " ").trim().slice(0, 180) || parsed.subject || "",
    date: parsed.date?.toISOString() || null,
    unread: !hasFlag(message.flags, "\\Seen"),
    starred: hasFlag(message.flags, "\\Flagged"),
    hasAttachments: parsed.attachments.length > 0,
  };
}

async function toDetailMessage(message: ParsedFetchedMessage) {
  const parsed = await simpleParser(message.raw);
  return {
    uid: message.uid,
    messageId: parsed.messageId || "",
    from: addressText(parsed.from),
    to: addressText(parsed.to),
    cc: addressText(parsed.cc),
    bcc: addressText(parsed.bcc),
    subject: parsed.subject || "(No subject)",
    date: parsed.date?.toISOString() || null,
    text: parsed.text || "",
    sanitizedHtml: sanitizeEmailHtml(parsed.html || undefined),
    attachments: parsed.attachments.map((attachment, index) => ({
      partId: String(index),
      filename: sanitizeFilename(attachment.filename, `attachment-${index + 1}`),
      contentType: attachment.contentType,
      size: attachment.size,
    })),
    unread: !hasFlag(message.flags, "\\Seen"),
    starred: hasFlag(message.flags, "\\Flagged"),
  };
}

function connectionClosedError() {
  const error = new Error("IMAP connection closed.");
  (error as Error & { code?: string }).code = "ConnectionClosed";
  return error;
}

function summarizeImapError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as Error & { code?: unknown }).code,
      responseCode: (error as Error & { responseCode?: unknown }).responseCode,
    };
  }
  return error;
}

function toWebmailHttpException(error: unknown) {
  if (error instanceof HttpException) return error;

  const code =
    typeof error === "object" && error ? String((error as { code?: unknown }).code || "") : "";
  const message = error instanceof Error ? error.message : String(error || "");
  const value = `${code} ${message}`;

  if (/authentication failed|authenticate failed|invalid credentials|auth|login/i.test(value)) {
    return new HttpException("Mailbox authentication failed.", HttpStatus.UNAUTHORIZED);
  }

  if (
    /NoConnection|ConnectionClosed|SocketError|connection not available|connection closed|socket error|timeout|timed out|ETIMEDOUT|ECONNRESET|EPIPE|closed/i.test(
      value,
    )
  ) {
    return new ServiceUnavailableException("Mail storage is temporarily unavailable.");
  }

  return new ServiceUnavailableException("Mail storage is temporarily unavailable.");
}

function addressText(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value))
    return value
      .map((item: any) => item.text)
      .filter(Boolean)
      .join(", ");
  return String((value as { text?: string }).text || "");
}

function hasFlag(flags: unknown, flag: string) {
  if (!flags) return false;
  if (Array.isArray(flags)) return flags.includes(flag);
  if (flags instanceof Set) return flags.has(flag);
  return false;
}

function folderRank(folder: { name: string; path: string; specialUse?: string }) {
  const value = `${folder.specialUse || ""} ${folder.name} ${folder.path}`.toLowerCase();
  if (value.includes("inbox")) return 0;
  if (value.includes("sent")) return 1;
  if (value.includes("draft")) return 2;
  if (value.includes("junk") || value.includes("spam")) return 3;
  if (value.includes("trash") || value.includes("deleted")) return 4;
  if (value.includes("archive")) return 5;
  return 10;
}
