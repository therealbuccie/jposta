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

const emailLayoutTags = [
  "a",
  "b",
  "blockquote",
  "br",
  "button",
  "center",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const emailCssValue =
  /^(?!.*(?:expression\s*\(|url\s*\(|javascript\s*:|vbscript\s*:|data\s*:|file\s*:|behavior\s*:)).+$/i;

const emailStyleProperties = [
  "display",
  "width",
  "max-width",
  "min-width",
  "height",
  "max-height",
  "min-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "text-align",
  "vertical-align",
  "line-height",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "color",
  "background",
  "background-color",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-radius",
  "border-collapse",
  "border-spacing",
  "white-space",
  "word-break",
  "overflow-wrap",
  "direction",
  "float",
];

const emailAllowedStyles = Object.fromEntries(
  emailStyleProperties.map((property) => [property, [emailCssValue]]),
);

const emailLayoutAttributes = [
  "align",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "colspan",
  "height",
  "role",
  "rowspan",
  "valign",
  "width",
];

export function sanitizeEmailHtml(html: string | false | undefined) {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: emailLayoutTags,
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "name", "target", "rel", "style", ...emailLayoutAttributes],
      button: ["type", "style", ...emailLayoutAttributes],
      img: [
        "src",
        "srcset",
        "alt",
        "title",
        "width",
        "height",
        "loading",
        "decoding",
        "style",
        "align",
        "border",
      ],
      table: ["style", ...emailLayoutAttributes],
      td: ["style", ...emailLayoutAttributes],
      th: ["scope", "style", ...emailLayoutAttributes],
      tr: ["style", ...emailLayoutAttributes],
    },
    allowedStyles: {
      "*": emailAllowedStyles,
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer noopener", target: "_blank" }),
    },
    allowedSchemes: ["cid", "http", "https", "mailto"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
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
