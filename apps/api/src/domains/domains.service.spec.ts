import { NotFoundException } from "@nestjs/common";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DomainsService } from "./domains.service";

describe("DomainsService ownership", () => {
  it("rejects domains outside the authenticated user's organizations", async () => {
    const service = new DomainsService(
      null as never,
      null as never,
      null as never,
      null as never,
      {
        domain: {
          findFirst: async () => null,
        },
      } as never,
    );

    await assert.rejects(
      () =>
        service.getById("domain-id", {
          id: "user-id",
          email: "a@b.com",
          name: "User",
          primaryEmail: "a@b.com",
          role: "USER",
          status: "ACTIVE",
          username: "a",
        }),
      NotFoundException,
    );
  });
});
