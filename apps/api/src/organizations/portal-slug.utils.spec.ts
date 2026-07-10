import { BadRequestException } from "@nestjs/common";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizePortalSlug, slugFromOrganizationName } from "./portal-slug.utils";

describe("portal slug utilities", () => {
  it("generates valid workspace slugs", () => {
    assert.equal(slugFromOrganizationName("Golivyn"), "golivyn");
    assert.equal(slugFromOrganizationName("36T Studios"), "36t-studios");
  });

  it("rejects reserved and malformed slugs", () => {
    assert.throws(() => normalizePortalSlug("admin"), BadRequestException);
    assert.throws(() => normalizePortalSlug("go--livyn"), BadRequestException);
    assert.throws(() => normalizePortalSlug("-golivyn"), BadRequestException);
  });
});
