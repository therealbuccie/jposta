import { BadRequestException, NotFoundException } from "@nestjs/common";
import sanitizeHtml from "sanitize-html";

export function normalizeFolderPath(value: unknown, fallback = "INBOX") {
  const folder = String(value || fallback).trim();
  if (!folder || folder.length > 120 || folder.includes("..") || /[\0\\]/.test(folder)) {
    throw new BadRequestException("Invalid folder.");
  }
  return folder;
}

export function normalizeUid(value: string) {
  const uid = Number(value);
  if (!Number.isSafeInteger(uid) || uid < 1) throw new NotFoundException("Message not found.");
  return uid;
}

export function normalizePage(value: unknown) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function normalizePageSize(value: unknown) {
  const pageSize = Number(value || 25);
  if (!Number.isInteger(pageSize) || pageSize < 1) return 25;
  return Math.min(pageSize, 100);
}

export function sanitizeEmailHtml(html: string | false | undefined) {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags
      .filter((tag) => !["embed", "form", "iframe", "object", "script"].includes(tag))
      .concat(["button", "img", "tbody", "td", "tfoot", "th", "thead", "tr"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      button: ["type"],
      img: ["src", "srcset", "alt", "title", "width", "height", "loading", "decoding"],
      table: ["align", "border", "cellpadding", "cellspacing", "role", "width"],
      td: ["align", "colspan", "rowspan", "valign", "width"],
      th: ["align", "colspan", "rowspan", "scope", "valign", "width"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer noopener", target: "_blank" }),
    },
    allowedSchemes: ["cid", "http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["cid", "http", "https"],
    },
  });
}
export function sanitizeFilename(value: string | undefined, fallback = "attachment") {
  const name = (value || fallback)
    .replace(/[\0\\/]/g, "_")
    .replace(/\.\.+/g, ".")
    .trim();
  return name.slice(0, 160) || fallback;
}

export function parseAddressList(value: unknown) {
  return String(value || "")
    .split(/[;,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function validateRecipients(...groups: unknown[]) {
  const recipients = groups.flatMap(parseAddressList);
  const unique = [...new Set(recipients)];
  if (!unique.length) throw new BadRequestException("At least one recipient is required.");
  if (unique.length > 20) throw new BadRequestException("A maximum of 20 recipients is allowed.");
  for (const recipient of unique) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
      throw new BadRequestException("One or more recipients are invalid.");
    }
  }
  return unique;
}
