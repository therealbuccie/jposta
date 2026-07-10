import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import nodemailer from "nodemailer";

import type { WebmailSessionService } from "./webmail-session.service";
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

const maxAttachmentCount = 10;
const maxAttachmentBytes = 25 * 1024 * 1024;

@Injectable()
export class WebmailSmtpService {
  async send(session: WebmailSession, input: SendInput, files: UploadFile[] = []) {
    if ((input as Record<string, unknown>).from) {
      throw new BadRequestException("From address cannot be supplied.");
    }
    validateRecipients(input.to, input.cc, input.bcc);
    const attachments = normalizeAttachments(files);
    const transporter = nodemailer.createTransport({
      host: "mail.jposta.com",
      port: 465,
      secure: true,
      auth: { user: session.mailbox.address, pass: session.credential },
      tls: { servername: "mail.jposta.com", rejectUnauthorized: true },
    });

    try {
      const result = await transporter.sendMail({
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
      });
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
