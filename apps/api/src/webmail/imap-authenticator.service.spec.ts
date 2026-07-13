import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ImapAuthenticator } from "./imap-authenticator.service";

describe("ImapAuthenticator integration", () => {
  it("authenticates a real mailbox when integration credentials are provided", async (context) => {
    const email = process.env.JPOSTA_TEST_IMAP_EMAIL;
    const password = process.env.JPOSTA_TEST_IMAP_PASSWORD;

    if (!email || !password) {
      context.skip("Set JPOSTA_TEST_IMAP_EMAIL and JPOSTA_TEST_IMAP_PASSWORD to run the real IMAP auth test.");
      return;
    }

    const authenticator = new ImapAuthenticator();
    await assert.doesNotReject(() => authenticator.authenticate(email, password));
  });
});
