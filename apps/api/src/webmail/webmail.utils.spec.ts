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

  it("sanitizes html and blocks remote images", () => {
    const html = sanitizeEmailHtml(
      '<p>Hello</p><script>alert(1)</script><img src="https://tracker.test/pixel.png" onload="x()">',
    );
    assert.match(html, /Hello/);
    assert.doesNotMatch(html, /script|onload|tracker\.test/);
    assert.match(html, /remote image blocked/);
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
