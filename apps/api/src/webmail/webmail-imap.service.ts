import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import type { WebmailSessionService } from "./webmail-session.service";
import {
  normalizeFolderPath,
  normalizePage,
  normalizePageSize,
  sanitizeEmailHtml,
  sanitizeFilename,
} from "./webmail.utils";

type WebmailSession = Awaited<ReturnType<WebmailSessionService["getSession"]>>;

type ListMessagesInput = {
  folder?: string;
  page?: unknown;
  pageSize?: unknown;
  search?: string;
  starredOnly?: unknown;
  unreadOnly?: unknown;
};

type ImapClient = any;

type MailboxLock = { release: () => void };

type MailboxConnectionOptions = {
  lockFolder?: string;
  socketTimeout?: number;
};

type ImapConnectionState = {
  connected: boolean;
};

@Injectable()
export class WebmailImapService {
  async listFolders(session: WebmailSession) {
    return this.withMailboxConnection(session.mailbox.address, session.credential, async (client) => {
      const state = getConnectionState(client);
      const folders = [] as Array<{
        name: string;
        path: string;
        specialUse?: string;
        total: number;
        unread: number;
      }>;

      await ensureUsableConnection(client, state, "LIST");
      for await (const mailbox of client.list()) {
        await ensureUsableConnection(client, state, "STATUS");
        const status = await client.status(mailbox.path, { messages: true, unseen: true });
        folders.push({
          path: mailbox.path,
          name: mailbox.name || mailbox.path,
          specialUse: mailbox.specialUse,
          total: Number(status?.messages || 0),
          unread: Number(status?.unseen || 0),
        });
      }

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

    return this.withMailboxConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        const state = getConnectionState(client);
        await ensureUsableConnection(client, state, "SELECT");
        const mailbox = client.mailbox;
        const total = Number(mailbox?.exists || 0);
        if (!total) return { folder, page, pageSize, total: 0, hasMore: false, messages: [] };

        let uids: number[] = [];
        if (input.search) {
          const query = String(input.search);
          await ensureUsableConnection(client, state, "SEARCH");
          const bodyUids = (await client.search({ body: query })) as number[];
          await ensureUsableConnection(client, state, "SEARCH");
          const subjectUids = (await client.search({ subject: query })) as number[];
          uids = [...new Set([...bodyUids, ...subjectUids])];
        } else if (input.unreadOnly === "true" || input.unreadOnly === true) {
          await ensureUsableConnection(client, state, "SEARCH");
          uids = (await client.search({ seen: false })) as number[];
        } else if (input.starredOnly === "true" || input.starredOnly === true) {
          await ensureUsableConnection(client, state, "SEARCH");
          uids = (await client.search({ flagged: true })) as number[];
        } else {
          const start = Math.max(1, total - page * pageSize + 1);
          const end = Math.max(1, total - (page - 1) * pageSize);
          uids = Array.from({ length: end - start + 1 }, (_, index) => start + index);
        }

        const sorted = [...uids].sort((a, b) => b - a);
        const pageUids =
          input.search || input.unreadOnly || input.starredOnly
            ? sorted.slice((page - 1) * pageSize, page * pageSize)
            : sorted;
        const messages = [] as unknown[];

        await ensureUsableConnection(client, state, "FETCH");
        for await (const message of client.fetch(
          pageUids,
          { envelope: true, flags: true, bodyStructure: true, uid: true },
          { uid: true },
        )) {
          messages.push(toListMessage(message));
        }

        return {
          folder,
          page,
          pageSize,
          total: input.search || input.unreadOnly || input.starredOnly ? sorted.length : total,
          hasMore:
            page * pageSize <
            (input.search || input.unreadOnly || input.starredOnly ? sorted.length : total),
          messages,
        };
      },
      { lockFolder: folder },
    );
  }

  async getMessage(session: WebmailSession, uid: number, folderValue?: string) {
    const folder = normalizeFolderPath(folderValue);
    return this.withMailboxConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        const state = getConnectionState(client);
        await ensureUsableConnection(client, state, "FETCH");
        const fetched = await client.fetchOne(
          uid,
          { source: true, envelope: true, flags: true, uid: true },
          { uid: true },
        );
        if (!fetched?.source) throw new NotFoundException("Message not found.");
        const parsed = await simpleParser(fetched.source);
        return {
          uid,
          messageId: parsed.messageId || fetched.envelope?.messageId || "",
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
          unread: !hasFlag(fetched.flags, "\\Seen"),
          starred: hasFlag(fetched.flags, "\\Flagged"),
        };
      },
      { lockFolder: folder },
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
    return this.withMailboxConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        const state = getConnectionState(client);
        await ensureUsableConnection(client, state, "MOVE");
        await client.messageMove(uid, toFolder, { uid: true });
        return { moved: true, fromFolder, toFolder, uid };
      },
      { lockFolder: fromFolder },
    );
  }

  async delete(session: WebmailSession, uid: number, folderValue?: string) {
    const folder = normalizeFolderPath(folderValue);
    const isTrash = /trash|deleted/i.test(folder);
    if (!isTrash) return this.move(session, uid, folder, "Trash");
    return this.withMailboxConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        const state = getConnectionState(client);
        await ensureUsableConnection(client, state, "EXPUNGE");
        await client.messageDelete(uid, { uid: true });
        return { deleted: true, permanent: true, uid };
      },
      { lockFolder: folder },
    );
  }

  async saveDraft(session: WebmailSession, rawMessage: string, uid?: number) {
    return this.withMailboxConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        const state = getConnectionState(client);
        if (uid) {
          await ensureUsableConnection(client, state, "EXPUNGE");
          await client.messageDelete(uid, { uid: true }).catch(() => null);
        }
        await ensureUsableConnection(client, state, "APPEND");
        const result = await client.append("Drafts", rawMessage, ["\\Draft"]);
        return { uid: Number(result.uid || 0) };
      },
      { lockFolder: "Drafts" },
    );
  }

  async deleteDraft(session: WebmailSession, uid: number) {
    return this.delete(session, uid, "Drafts");
  }

  async getAttachment(session: WebmailSession, uid: number, partId: string, folderValue?: string) {
    const folder = normalizeFolderPath(folderValue);
    return this.withMailboxConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        const state = getConnectionState(client);
        await ensureUsableConnection(client, state, "FETCH");
        const fetched = await client.fetchOne(uid, { source: true }, { uid: true });
        if (!fetched?.source) throw new NotFoundException("Message not found.");
        const parsed = await simpleParser(fetched.source);
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
      { lockFolder: folder },
    );
  }

  async health() {
    const client = this.createImapClient("healthcheck", "healthcheck", 3000);
    const state: ImapConnectionState = { connected: false };
    setConnectionState(client, state);
    attachImapErrorHandlers(client);
    try {
      await ensureUsableConnection(client, state, "CONNECT");
      return true;
    } catch {
      return false;
    } finally {
      await logoutOrDestroy(client);
    }
  }

  private async updateFlag(
    session: WebmailSession,
    uid: number,
    folderValue: string | undefined,
    flag: string,
    enabled: boolean,
  ) {
    const folder = normalizeFolderPath(folderValue);
    return this.withMailboxConnection(
      session.mailbox.address,
      session.credential,
      async (client) => {
        const state = getConnectionState(client);
        await ensureUsableConnection(client, state, "STORE");
        if (enabled) await client.messageFlagsAdd(uid, [flag], { uid: true });
        else await client.messageFlagsRemove(uid, [flag], { uid: true });
        return { uid, folder, updated: true };
      },
      { lockFolder: folder },
    );
  }

  private async withMailboxConnection<T>(
    mailbox: string,
    password: string,
    callback: (client: ImapClient) => Promise<T>,
    options: MailboxConnectionOptions = {},
  ) {
    const client = this.createImapClient(mailbox, password, options.socketTimeout ?? 12000);
    const state: ImapConnectionState = { connected: false };
    setConnectionState(client, state);
    attachImapErrorHandlers(client);
    let lock: MailboxLock | undefined;

    try {
      await ensureUsableConnection(client, state, "CONNECT");

      if (options.lockFolder) {
        await ensureUsableConnection(client, state, "SELECT");
        lock = (await client.getMailboxLock(options.lockFolder)) as MailboxLock;
      }

      await ensureUsableConnection(client, state, "CALLBACK");
      return await callback(client);
    } catch (error) {
      throw toWebmailHttpException(error);
    } finally {
      if (lock) releaseMailboxLock(lock);
      await logoutOrDestroy(client);
    }
  }

  protected createImapClient(mailbox: string, password: string, socketTimeout: number) {
    const host = process.env.WEBMAIL_IMAP_HOST || process.env.IMAP_HOST || "mail.jposta.com";
    const port = Number.parseInt(process.env.WEBMAIL_IMAP_PORT || process.env.IMAP_PORT || "993", 10);
    return new ImapFlow({
      host,
      port: Number.isInteger(port) ? port : 993,
      secure: true,
      auth: { user: mailbox, pass: password },
      tls: {
        servername:
          process.env.WEBMAIL_IMAP_SERVERNAME || process.env.IMAP_SERVERNAME || host,
        rejectUnauthorized: process.env.WEBMAIL_IMAP_REJECT_UNAUTHORIZED !== "false",
      },
      logger: false,
      socketTimeout,
    } as never) as ImapClient;
  }
}

const connectionStates = new WeakMap<object, ImapConnectionState>();

function setConnectionState(client: ImapClient, state: ImapConnectionState) {
  if (typeof client === "object" && client) connectionStates.set(client, state);
}

function getConnectionState(client: ImapClient) {
  if (typeof client === "object" && client) return connectionStates.get(client) ?? { connected: false };
  return { connected: false };
}

async function ensureUsableConnection(client: ImapClient, state: ImapConnectionState, command: string) {
  if (client.usable) return;
  if (!state.connected) {
    await client.connect();
    state.connected = true;
    if (client.usable) return;
  }

  const error = new Error(`IMAP connection is not usable before ${command}.`);
  (error as Error & { code?: string }).code = "NoConnection";
  throw error;
}

function attachImapErrorHandlers(client: ImapClient) {
  if (!client || typeof client.on !== "function") return;
  client.on("error", (error: unknown) => {
    console.error("Webmail IMAP client emitted an error", summarizeImapError(error));
  });
  client.on("close", () => {
    console.warn("Webmail IMAP client connection closed");
  });
}

function releaseMailboxLock(lock: MailboxLock) {
  try {
    lock.release();
  } catch {
    // Lock release is best-effort; the connection cleanup below still runs.
  }
}

async function logoutOrDestroy(client: ImapClient) {
  try {
    if (client.usable) await client.logout();
    else destroyImapClient(client);
  } catch {
    destroyImapClient(client);
  }
}

function destroyImapClient(client: ImapClient) {
  const maybeClient = client as ImapClient & {
    _socket?: { destroy?: () => void };
    _connection?: { socket?: { destroy?: () => void } };
  };

  const cleanupFns = [
    () => maybeClient.socket?.destroy?.(),
    () => maybeClient._socket?.destroy?.(),
    () => maybeClient._connection?.socket?.destroy?.(),
    () => maybeClient.close?.(),
    () => maybeClient.destroy?.(),
  ];

  for (const cleanup of cleanupFns) {
    try {
      cleanup();
    } catch {
      // Ignore low-level socket cleanup failures. The request already has a safe HTTP response.
    }
  }
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

  const code = typeof error === "object" && error ? String((error as { code?: unknown }).code || "") : "";
  const message = error instanceof Error ? error.message : String(error || "");
  const value = `${code} ${message}`;

  if (/authentication failed|authenticate failed|invalid credentials|auth/i.test(value)) {
    return new HttpException("Mailbox authentication failed.", HttpStatus.UNAUTHORIZED);
  }

  if (/NoConnection|ConnectionClosed|SocketError|connection not available|connection closed|socket error|timeout|timed out|ETIMEDOUT|ECONNRESET|EPIPE/i.test(value)) {
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

function toListMessage(message: any) {
  const envelope = message.envelope || {};
  const from = formatAddress(envelope.from?.[0]);
  return {
    uid: message.uid,
    messageId: envelope.messageId || "",
    from,
    to: (envelope.to || []).map(formatAddress).filter(Boolean).join(", "),
    subject: envelope.subject || "(No subject)",
    preview: envelope.subject || "",
    date: envelope.date?.toISOString?.() || null,
    unread: !hasFlag(message.flags, "\\Seen"),
    starred: hasFlag(message.flags, "\\Flagged"),
    hasAttachments: Boolean(
      message.bodyStructure?.childNodes?.some?.((node: any) => node.disposition === "attachment"),
    ),
  };
}

function formatAddress(address: any) {
  if (!address) return "";
  const email = [address.mailbox, address.host].filter(Boolean).join("@");
  return address.name ? `${address.name} <${email}>` : email;
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
