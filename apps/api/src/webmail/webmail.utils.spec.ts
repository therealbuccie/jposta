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
        '<center><table width="600" height="200" cellpadding="18" cellspacing="0" border="0" bgcolor="#f8fbff" role="presentation" style="width:600px; max-width:100%; border-collapse:collapse; margin:0 auto; background-color:#f8fbff;">',
        '<tbody><tr><td align="center" valign="top" colspan="2" style="padding:24px; text-align:center; vertical-align:top; line-height:1.6; font-size:18px; color:#102a43;">',
        '<h1 style="font-family:Arial, sans-serif; font-size:28px; line-height:34px; margin:0 0 12px;">Hello <strong>there</strong></h1>',
        '<p style="margin:0 0 16px; text-align:left;">Left aligned intro.</p>',
        '<p style="margin:0; text-align:right;">Right aligned note.</p>',
        '<a href="https://example.com/action" style="display:inline-block; padding:12px 18px; background:#2563eb; color:#ffffff; border-radius:12px; text-decoration:none;">Open</a>',
        '<button type="button" onclick="evil()" style="padding:10px 14px; background-color:#eef6ff; border:1px solid #bfdbfe; border-radius:10px;">Action</button>',
        '<img src="https://cdn.example.com/logo.png" srcset="https://cdn.example.com/logo@2x.png 2x" alt="Logo" title="Company" width="120" height="40" loading="lazy" decoding="async" style="display:block; width:120px; height:40px; margin:16px auto;" onload="x()" class="logo" id="logo">',
        '<img src="http://cdn.example.com/banner.png" alt="Banner">',
        '<img src="cid:inline-image-1" alt="Inline">',
        '<img src="javascript:alert(1)" alt="Bad">',
        '<script>alert(1)</script><iframe src="https://evil.example"></iframe><object data="x"></object><form><input name="x"></form>',
        "</td></tr></tbody></table></center>",
      ].join(""),
    );

    assert.match(html, /<center>/);
    assert.match(html, /<table/);
    assert.match(html, /width="600"/);
    assert.match(html, /height="200"/);
    assert.match(html, /cellpadding="18"/);
    assert.match(html, /cellspacing="0"/);
    assert.match(html, /bgcolor="#f8fbff"/);
    assert.match(html, /role="presentation"/);
    assert.match(html, /border-collapse:collapse/);
    assert.match(html, /margin:0 auto/);
    assert.match(html, /<td/);
    assert.match(html, /align="center"/);
    assert.match(html, /valign="top"/);
    assert.match(html, /colspan="2"/);
    assert.match(html, /text-align:center/);
    assert.match(html, /line-height:1\.6/);
    assert.match(html, /font-size:18px/);
    assert.match(html, /font-size:28px/);
    assert.match(html, /text-align:left/);
    assert.match(html, /text-align:right/);
    assert.match(html, /padding:12px 18px/);
    assert.match(html, /background:#2563eb/);
    assert.match(html, /border-radius:12px/);
    assert.match(html, /<button type="button" style="[^"]*padding:10px 14px/);
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

  it("removes unsafe email CSS and URL schemes", () => {
    const html = sanitizeEmailHtml(
      [
        '<p style="position:fixed; z-index:999; color:#111111; behavior:url(test.htc); width:100%;">Safe text</p>',
        '<span style="padding:8px;">Badge</span><span style="background:url(javascript:alert(1)); expression(alert(1));">Unsafe badge</span>',
        '<a href="javascript:alert(1)" style="color:#2563eb; text-decoration:underline;">Bad link</a>',
        '<img src="data:image/png;base64,aaaa" alt="Bad data">',
        '<img src="file:///tmp/logo.png" alt="Bad file">',
        '<img src="vbscript:alert(1)" alt="Bad vbscript">',
      ].join(""),
    );

    assert.match(html, /color:#111111/);
    assert.match(html, /width:100%/);
    assert.match(html, /padding:8px/);
    assert.match(html, /text-decoration:underline/);
    assert.doesNotMatch(html, /position|z-index|behavior|expression|url\(|javascript:|data:image|file:\/\/|vbscript:/i);
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
