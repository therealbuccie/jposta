import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAllowedCorsOrigin } from "./main";

describe("CORS origin validation", () => {
  it("allows approved JPosta origins", () => {
    assert.equal(isAllowedCorsOrigin("https://jposta.com"), true);
    assert.equal(isAllowedCorsOrigin("https://www.jposta.com"), true);
    assert.equal(isAllowedCorsOrigin("https://golivyn.jposta.com"), true);
  });

  it("rejects malicious subdomains", () => {
    assert.equal(isAllowedCorsOrigin("https://golivyn.jposta.com.evil.com"), false);
    assert.equal(isAllowedCorsOrigin("https://evil.com"), false);
  });
});
