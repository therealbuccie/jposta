import { BadRequestException } from "@nestjs/common";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeUsername, primaryEmailForUsername } from "./username.utils";

describe("username utilities", () => {
  it("normalizes safe usernames and generates primary emails", () => {
    assert.equal(normalizeUsername(" Onyebuchi "), "onyebuchi");
    assert.equal(normalizeUsername("obi.mail_01"), "obi.mail_01");
    assert.equal(primaryEmailForUsername("onyebuchi"), "onyebuchi@jposta.com");
  });

  it("rejects reserved usernames", () => {
    assert.throws(() => normalizeUsername("admin"), BadRequestException);
    assert.throws(() => normalizeUsername("postmaster"), BadRequestException);
    assert.throws(() => normalizeUsername("mailer-daemon"), BadRequestException);
  });

  it("rejects unsafe or malformed usernames", () => {
    assert.throws(() => normalizeUsername("ab"), BadRequestException);
    assert.throws(() => normalizeUsername(".onyebuchi"), BadRequestException);
    assert.throws(() => normalizeUsername("onyebuchi."), BadRequestException);
    assert.throws(() => normalizeUsername("onye..buchi"), BadRequestException);
    assert.throws(() => normalizeUsername("onye;rm"), BadRequestException);
  });
});
