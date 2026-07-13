import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { EventEmitter } from "node:events";
import nodemailer from "nodemailer";

import type { WebmailSessionService } from "./webmail-session.service";
import { sanitizeFilename, validateRecipients } from "./webmail.utils";

const NodeImap = require("node-imap") as new (config: Record<string, unknown>) => SentImapClient;

type WebmailSession = Awaited<ReturnType<WebmailSessionService["getSession"]>>;

type SendInput = {
  bcc?: string;
  cc?: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
  replyTo?: string;
  subject?: string;
  text?: string;
  to?: string;
};

type UploadFile = {
  buffer?: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
};

type NormalizedAttachment = {
  content?: Buffer;
  contentType: string;
  filename: string;
};

type MailPayload = {
  attachments: NormalizedAttachment[];
  bcc?: string;
  cc?: string;
  from: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
  replyTo?: string;
  subject: string;
  text?: string;
  to?: string;
};

type SentImapClient = EventEmitter & {
  append: (
    message: Buffer,
    options: { flags?: string[]; mailbox: string },
    callback: (error: Error | null) => void,
  ) => void;
  connect: () => void;
  end: () => void;
  getBoxes: (callback: (error: Error | null, boxes: ImapBoxes) => void) => void;
};

type ImapBoxes = Record<
  string,
  {
    attribs?: string[];
    children?: ImapBoxes | null;
    delimiter?: string;
  }
>;

const maxAttachmentCount = 10;
const maxAttachmentBytes = 25 * 1024 * 1024;
const defaultImapTimeoutMs = 12000;

@Injectable()
export class WebmailSmtpService {
  async send(session: WebmailSession, input: SendInput, files: UploadFile[] = []) {
    if ((input as Record<string, unknown>).from) {
      throw new BadRequestException("From address cannot be supplied.");
    }
    const recipients = validateRecipients(input.to, input.cc, input.bcc);
    const attachments = normalizeAttachments(files);
    const message = buildMailPayload(session, input, attachments);
    const rawMessage = await this.buildRawMessage(message);
    const transporter = this.createSmtpTransport(session);

    try {
      const result = await transporter.sendMail({
        envelope: {
          from: session.mailbox.address,
          to: recipients,
        },
        raw: rawMessage,
      });
      await this.appendSentCopy(session, rawMessage);
      return {
        messageId: result.messageId,
        accepted: (result.accepted || []).map(String),
        rejected: (result.rejected || []).map(String),
      };
    } catch {
      throw new ServiceUnavailableException("Message could not be sent right now.");
    }
  }

  async health() {
    const transporter = nodemailer.createTransport({
      host: "mail.jposta.com",
      port: 465,
      secure: true,
      auth: { user: "healthcheck", pass: "healthcheck" },
      tls: { servername: "mail.jposta.com", rejectUnauthorized: true },
    });
    return transporter.verify().then(
      () => true,
      () => false,
    );
  }

  protected createSmtpTransport(session: WebmailSession) {
    return nodemailer.createTransport({
      host: "mail.jposta.com",
      port: 465,
      secure: true,
      auth: { user: session.mailbox.address, pass: session.credential },
      tls: { servername: "mail.jposta.com", rejectUnauthorized: true },
    });
  }

  protected createMimeTransport() {
    return nodemailer.createTransport({
      buffer: true,
      newline: "windows",
      streamTransport: true,
    });
  }

  protected createImapClient(session: WebmailSession, timeoutMs: number) {
    const host = process.env.IMAP_HOST || process.env.WEBMAIL_IMAP_HOST || "jposta-mailserver";
    const port = Number.parseInt(
      process.env.IMAP_PORT || process.env.WEBMAIL_IMAP_PORT || "993",
      10,
    );
    const secure =
      (process.env.IMAP_SECURE || process.env.WEBMAIL_IMAP_SECURE || "true") !== "false";

    return new NodeImap({
      user: session.mailbox.address,
      password: session.credential,
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
      authTimeout: timeoutMs,
      connTimeout: timeoutMs,
      keepalive: false,
    }) as SentImapClient;
  }

  private async buildRawMessage(message: MailPayload) {
    const result = await this.createMimeTransport().sendMail(message);
    const raw = (result as { message?: Buffer | string }).message;
    if (Buffer.isBuffer(raw)) return raw;
    if (typeof raw === "string") return Buffer.from(raw);
    throw new ServiceUnavailableException("Message could not be sent right now.");
  }

  private async appendSentCopy(session: WebmailSession, rawMessage: Buffer) {
    try {
      await withSentImapClient(session, this.createImapClient.bind(this), async (client) => {
        const boxes = await imapCallback<ImapBoxes>((done) => client.getBoxes(done));
        const sentMailbox = findSpecialUseMailbox(boxes, "\\Sent") || "Sent";
        await imapCallback<void>((done) =>
          client.append(rawMessage, { flags: ["\\Seen"], mailbox: sentMailbox }, done),
        );
      });
    } catch (error) {
      console.warn("Webmail sent-copy append failed", summarizeSafeError(error));
    }
  }
}

export function buildDraftMessage(session: WebmailSession, input: SendInput) {
  validateRecipients(input.to || "draft@example.invalid");
  const headers = [
    `From: ${session.mailbox.address}`,
    input.to ? `To: ${input.to}` : "",
    input.cc ? `Cc: ${input.cc}` : "",
    `Subject: ${input.subject || "(No subject)"}`,
    "MIME-Version: 1.0",
    input.html
      ? 'Content-Type: text/html; charset="utf-8"'
      : 'Content-Type: text/plain; charset="utf-8"',
  ].filter(Boolean);
  return `${headers.join("\r\n")}\r\n\r\n${input.html || input.text || ""}`;
}

function buildMailPayload(
  session: WebmailSession,
  input: SendInput,
  attachments: NormalizedAttachment[],
): MailPayload {
  return {
    from: session.mailbox.address,
    ...(input.to ? { to: input.to } : {}),
    ...(input.cc ? { cc: input.cc } : {}),
    ...(input.bcc ? { bcc: input.bcc } : {}),
    subject: input.subject || "(No subject)",
    ...(input.text ? { text: input.text } : {}),
    ...(input.html ? { html: input.html } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
    ...(input.references ? { references: input.references } : {}),
    attachments,
  };
}

function normalizeAttachments(files: UploadFile[]): NormalizedAttachment[] {
  if (files.length > maxAttachmentCount)
    throw new BadRequestException("A maximum of 10 attachments is allowed.");
  const total = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (total > maxAttachmentBytes)
    throw new BadRequestException("Attachments cannot exceed 25 MB total.");
  return files.map((file) => ({
    filename: sanitizeFilename(file.originalname),
    ...(file.buffer ? { content: file.buffer } : {}),
    contentType: file.mimetype || "application/octet-stream",
  }));
}

async function withSentImapClient(
  session: WebmailSession,
  createClient: (session: WebmailSession, timeoutMs: number) => SentImapClient,
  callback: (client: SentImapClient) => Promise<void>,
) {
  const client = createClient(session, defaultImapTimeoutMs);
  let ended = false;
  const errors: unknown[] = [];
  const onError = (error: unknown) => errors.push(error);
  const onEnd = () => {
    ended = true;
  };

  client.on("error", onError);
  client.on("end", onEnd);
  client.on("close", onEnd);

  try {
    await withTimeout(waitForReady(client), defaultImapTimeoutMs, "CONNECT");
    await withTimeout(callback(client), defaultImapTimeoutMs, "APPEND");
  } finally {
    await safeEndClient(client, defaultImapTimeoutMs, () => ended).catch((error) => {
      errors.push(error);
    });
    client.removeListener("error", onError);
    client.removeListener("end", onEnd);
    client.removeListener("close", onEnd);
    if (errors.length) {
      console.info("Webmail sent-copy IMAP cleanup consumed errors", { count: errors.length });
    }
  }
}

function waitForReady(client: SentImapClient) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      client.removeListener("ready", onReady);
      client.removeListener("error", onError);
      client.removeListener("close", onClose);
      client.removeListener("end", onClose);
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
      reject(new Error("IMAP connection closed."));
    };

    client.once("ready", onReady);
    client.once("error", onError);
    client.once("close", onClose);
    client.once("end", onClose);
    client.connect();
  });
}

async function safeEndClient(client: SentImapClient, timeoutMs: number, isEnded: () => boolean) {
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

function imapCallback<T>(start: (done: (error: Error | null, result: T) => void) => void) {
  return new Promise<T>((resolve, reject) => {
    start((error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`IMAP ${operation} timed out.`)), timeoutMs);
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

function findSpecialUseMailbox(
  boxes: ImapBoxes,
  specialUse: string,
  parentPath = "",
): string | null {
  for (const [name, box] of Object.entries(boxes || {})) {
    const delimiter = box.delimiter || "/";
    const path = parentPath ? `${parentPath}${delimiter}${name}` : name;
    const attribs = box.attribs || [];
    if (attribs.some((attribute) => attribute.toLowerCase() === specialUse.toLowerCase())) {
      return path;
    }
    if (box.children) {
      const child = findSpecialUseMailbox(box.children, specialUse, path);
      if (child) return child;
    }
  }
  return null;
}

function summarizeSafeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as Error & { code?: unknown }).code,
    };
  }
  return { message: String(error) };
}
