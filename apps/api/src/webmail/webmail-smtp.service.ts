import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import nodemailer from "nodemailer";

import type { WebmailSessionService } from "./webmail-session.service";
import { WebmailImapService } from "./webmail-imap.service";
import { sanitizeFilename, validateRecipients } from "./webmail.utils";

type WebmailSession = Awaited<ReturnType<WebmailSessionService["getSession"]>>;

type SendInput = {
  bcc?: string;
  cc?: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
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

type MailAttachment = {
  content: Buffer | undefined;
  contentType: string;
  filename: string;
};

type MailOptions = {
  attachments: MailAttachment[];
  bcc: string | undefined;
  cc: string | undefined;
  from: string;
  html: string | undefined;
  inReplyTo: string | undefined;
  references: string | undefined;
  subject: string;
  text: string | undefined;
  to: string | undefined;
};

type MailTransporter = {
  sendMail: (options: Record<string, unknown>) => Promise<{
    accepted?: unknown[];
    message?: Buffer | string;
    messageId?: string;
    rejected?: unknown[];
  }>;
  verify?: () => Promise<unknown>;
};

const maxAttachmentCount = 10;
const maxAttachmentBytes = 25 * 1024 * 1024;

@Injectable()
export class WebmailSmtpService {
  constructor(private readonly imap?: WebmailImapService) {}

  async send(session: WebmailSession, input: SendInput, files: UploadFile[] = []) {
    if ((input as Record<string, unknown>).from) {
      throw new BadRequestException("From address cannot be supplied.");
    }
    validateRecipients(input.to, input.cc, input.bcc);
    const attachments = normalizeAttachments(files);
    const mail = buildMailOptions(session, input, attachments);
    const transporter = this.createSmtpTransporter(session);

    let rawMessage: Buffer;
    let result: { accepted?: unknown[]; messageId?: string; rejected?: unknown[] };
    try {
      rawMessage = await this.buildRawMessage(mail);
      result = await transporter.sendMail({
        envelope: buildEnvelope(session, input),
        raw: rawMessage,
      });
    } catch {
      throw new ServiceUnavailableException("Message could not be sent right now.");
    }

    if (this.imap) {
      await this.imap.appendSentMessage(session, rawMessage).catch((error: unknown) => {
        console.warn("Webmail Sent append failed after SMTP success", {
          mailbox: session.mailbox.address,
          messageId: result.messageId,
          ...summarizeMailError(error),
        });
      });
    }

    return {
      messageId: result.messageId,
      accepted: (result.accepted || []).map(String),
      rejected: (result.rejected || []).map(String),
    };
  }

  async health() {
    const transporter = this.createSmtpTransporter({
      mailbox: { address: "healthcheck" },
      credential: "healthcheck",
    } as WebmailSession);
    return transporter.verify?.().then(
      () => true,
      () => false,
    ) ?? false;
  }

  protected createSmtpTransporter(session: WebmailSession): MailTransporter {
    return nodemailer.createTransport({
      host: "mail.jposta.com",
      port: 465,
      secure: true,
      auth: { user: session.mailbox.address, pass: session.credential },
      tls: { servername: "mail.jposta.com", rejectUnauthorized: true },
    }) as MailTransporter;
  }

  protected createMimeTransporter(): MailTransporter {
    return nodemailer.createTransport({ streamTransport: true, buffer: true }) as MailTransporter;
  }

  private async buildRawMessage(mail: MailOptions) {
    const result = await this.createMimeTransporter().sendMail(mail as unknown as Record<string, unknown>);
    if (!result.message) throw new Error("MIME message was not generated.");
    return Buffer.isBuffer(result.message) ? result.message : Buffer.from(result.message);
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

function buildMailOptions(session: WebmailSession, input: SendInput, attachments: MailAttachment[]): MailOptions {
  return {
    from: session.mailbox.address,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject || "(No subject)",
    text: input.text || undefined,
    html: input.html || undefined,
    inReplyTo: input.inReplyTo || undefined,
    references: input.references || undefined,
    attachments,
  };
}

function buildEnvelope(session: WebmailSession, input: SendInput) {
  return {
    from: session.mailbox.address,
    to: splitRecipients(input.to, input.cc, input.bcc),
  };
}

function splitRecipients(...values: Array<string | undefined>) {
  return values
    .flatMap((value) => (value || "").split(/[;,]/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeAttachments(files: UploadFile[]) {
  if (files.length > maxAttachmentCount)
    throw new BadRequestException("A maximum of 10 attachments is allowed.");
  const total = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (total > maxAttachmentBytes)
    throw new BadRequestException("Attachments cannot exceed 25 MB total.");
  return files.map((file) => ({
    filename: sanitizeFilename(file.originalname),
    content: file.buffer,
    contentType: file.mimetype || "application/octet-stream",
  }));
}

function summarizeMailError(error: unknown) {
  if (error instanceof Error) return { message: error.message, name: error.name };
  return { message: String(error) };
}
