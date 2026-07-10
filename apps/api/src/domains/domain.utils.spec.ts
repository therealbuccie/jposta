import { BadRequestException } from "@nestjs/common";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeDomainName } from "./domain.utils";

describe("normalizeDomainName", () => {
  it("normalizes lowercase domains and removes a trailing dot", () => {
    assert.equal(normalizeDomainName(" GoLyVin.COM. "), "golyvin.com");
  });

  it("rejects unsafe or invalid domains", () => {
    assert.throws(() => normalizeDomainName("bad;domain.com"), BadRequestException);
    assert.throws(() => normalizeDomainName("-bad.example"), BadRequestException);
    assert.throws(() => normalizeDomainName("bad..example.com"), BadRequestException);
  });
});
