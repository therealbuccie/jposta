import { BadRequestException } from "@nestjs/common";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeMailboxLocalPart } from "./mailbox.utils";

describe("normalizeMailboxLocalPart", () => {
  it("normalizes safe local parts", () => {
    assert.equal(normalizeMailboxLocalPart(" Support.Team "), "support.team");
    assert.equal(normalizeMailboxLocalPart("a"), "a");
  });

  it("rejects shell metacharacters and invalid dot placement", () => {
    assert.throws(() => normalizeMailboxLocalPart("support;rm"), BadRequestException);
    assert.throws(() => normalizeMailboxLocalPart(".support"), BadRequestException);
    assert.throws(() => normalizeMailboxLocalPart("support..team"), BadRequestException);
  });
});
