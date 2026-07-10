import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
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

@Injectable()
export class WebmailImapService {
  async listFolders(session: WebmailSession) {
    return this.withClient(session, async (client) => {
      const folders = [] as Array<{
        name: string;
        path: string;
        specialUse?: string;
        total: number;
        unread: number;
      }>;
      for await (const mailbox of client.list()) {
        const status = await client
          .status(mailbox.path, { messages: true, unseen: true })
          .catch(() => null);
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
    return this.withClient(session, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const mailbox = client.mailbox;
        const total = Number(mailbox.exists || 0);
        if (!total) return { folder, page, pageSize, total: 0, hasMore: false, messages: [] };

        let uids: number[] = [];
        if (input.search) {
          uids = (await client.search({
            body: String(input.search),
            subject: String(input.search),
          })) as number[];
        } else if (input.unreadOnly === "true" || input.unreadOnly === true) {
          uids = (await client.search({ seen: false })) as number[];
        } else if (input.starredOnly === "true" || input.starredOnly === true) {
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
      } finally {
        lock.release();
      }
    });
  }

  async getMessage(session: WebmailSession, uid: number, folderValue?: string) {
    const folder = normalizeFolderPath(folderValue);
    return this.withClient(session, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
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
      } finally {
        lock.release();
      }
    });
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
    return this.withClient(session, async (client) => {
      const lock = await client.getMailboxLock(fromFolder);
      try {
        await client.messageMove(uid, toFolder, { uid: true });
        return { moved: true, fromFolder, toFolder, uid };
      } finally {
        lock.release();
      }
    });
  }

  async delete(session: WebmailSession, uid: number, folderValue?: string) {
    const folder = normalizeFolderPath(folderValue);
    const isTrash = /trash|deleted/i.test(folder);
    if (!isTrash) return this.move(session, uid, folder, "Trash");
    return this.withClient(session, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageDelete(uid, { uid: true });
        return { deleted: true, permanent: true, uid };
      } finally {
        lock.release();
      }
    });
  }

  async saveDraft(session: WebmailSession, rawMessage: string, uid?: number) {
    return this.withClient(session, async (client) => {
      if (uid) await client.messageDelete(uid, { uid: true }).catch(() => null);
      const result = await client.append("Drafts", rawMessage, ["\\Draft"]);
      return { uid: Number(result.uid || 0) };
    });
  }

  async deleteDraft(session: WebmailSession, uid: number) {
    return this.delete(session, uid, "Drafts");
  }

  async getAttachment(session: WebmailSession, uid: number, partId: string, folderValue?: string) {
    const detail = await this.getMessage(session, uid, folderValue);
    const attachment = detail.attachments[Number(partId)];
    if (!attachment) throw new NotFoundException("Attachment not found.");
    return { metadata: attachment };
  }

  async health() {
    try {
      const client = new ImapFlow({
        host: "mail.jposta.com",
        port: 993,
        secure: true,
        auth: { user: "healthcheck", pass: "healthcheck" },
        tls: { servername: "mail.jposta.com", rejectUnauthorized: true },
        logger: false,
        socketTimeout: 3000,
      } as never);
      await client.connect().catch(() => null);
      await client.logout().catch(() => null);
      return true;
    } catch {
      return false;
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
    return this.withClient(session, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        if (enabled) await client.messageFlagsAdd(uid, [flag], { uid: true });
        else await client.messageFlagsRemove(uid, [flag], { uid: true });
        return { uid, folder, updated: true };
      } finally {
        lock.release();
      }
    });
  }

  private async withClient<T>(session: WebmailSession, handler: (client: any) => Promise<T>) {
    const client = new ImapFlow({
      host: "mail.jposta.com",
      port: 993,
      secure: true,
      auth: { user: session.mailbox.address, pass: session.credential },
      tls: { servername: "mail.jposta.com", rejectUnauthorized: true },
      logger: false,
      socketTimeout: 12000,
    } as never);
    try {
      await client.connect();
      return await handler(client as any);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException("Mail storage is temporarily unavailable.");
    } finally {
      await client.logout().catch(() => null);
    }
  }
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
