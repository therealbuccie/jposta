import { BadRequestException, NotFoundException } from "@nestjs/common";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeFolderPath,
  normalizeUid,
  sanitizeEmailHtml,
  sanitizeFilename,
  validateRecipients,
} from "./webmail.utils";

describe("webmail utilities", () => {
  it("normalizes safe folders and rejects traversal", () => {
    assert.equal(normalizeFolderPath("INBOX"), "INBOX");
    assert.throws(() => normalizeFolderPath("../INBOX"), BadRequestException);
    assert.throws(() => normalizeFolderPath("bad\\folder"), BadRequestException);
  });

  it("validates message UIDs", () => {
    assert.equal(normalizeUid("42"), 42);
    assert.throws(() => normalizeUid("0"), NotFoundException);
  });

  it("sanitizes html while preserving safe email image and layout markup", () => {
    const html = sanitizeEmailHtml(
      [
        '<table width="600" cellpadding="0" cellspacing="0"><tbody><tr><td align="center">',
        '<p>Hello <strong>there</strong></p>',
        '<a href="https://example.com/action">Open</a>',
        '<button type="button" onclick="evil()">Action</button>',
        '<img src="https://cdn.example.com/logo.png" srcset="https://cdn.example.com/logo@2x.png 2x" alt="Logo" title="Company" width="120" height="40" loading="lazy" decoding="async" onload="x()" class="logo" id="logo">',
        '<img src="http://cdn.example.com/banner.png" alt="Banner">',
        '<img src="cid:inline-image-1" alt="Inline">',
        '<img src="javascript:alert(1)" alt="Bad">',
        '<script>alert(1)</script><iframe src="https://evil.example"></iframe><object data="x"></object><form><input name="x"></form>',
        "</td></tr></tbody></table>",
      ].join(""),
    );

    assert.match(html, /Hello/);
    assert.match(html, /<table/);
    assert.match(html, /<tbody/);
    assert.match(html, /<tr/);
    assert.match(html, /<td/);
    assert.match(html, /<button type="button">Action<\/button>/);
    assert.match(html, /src="https:\/\/cdn\.example\.com\/logo\.png"/);
    assert.match(html, /srcset="https:\/\/cdn\.example\.com\/logo@2x\.png 2x"/);
    assert.match(html, /alt="Logo"/);
    assert.match(html, /title="Company"/);
    assert.match(html, /width="120"/);
    assert.match(html, /height="40"/);
    assert.match(html, /loading="lazy"/);
    assert.match(html, /decoding="async"/);
    assert.match(html, /src="http:\/\/cdn\.example\.com\/banner\.png"/);
    assert.match(html, /src="cid:inline-image-1"/);
    assert.doesNotMatch(html, /remote image blocked/);
    assert.doesNotMatch(html, /javascript:alert/);
    assert.doesNotMatch(html, /onload|onclick|class=|id=|script|iframe|object|form|input/);
  });

  it("validates recipients and sanitizes filenames", () => {
    assert.deepEqual(validateRecipients("a@example.com", "b@example.com"), [
      "a@example.com",
      "b@example.com",
    ]);
    assert.throws(() => validateRecipients("not-an-email"), BadRequestException);
    assert.equal(sanitizeFilename("../invoice.pdf"), "._invoice.pdf");
  });
});
