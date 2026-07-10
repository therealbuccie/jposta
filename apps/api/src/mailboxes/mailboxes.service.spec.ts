import { BadRequestException } from "@nestjs/common";
import { DomainStatus, MailboxStatus, MailboxType } from "@prisma/client";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MailboxesService } from "./mailboxes.service";

const authUser = {
  id: "user-id",
  email: "owner@jposta.com",
  name: "Owner",
  primaryEmail: "owner@jposta.com",
  role: "WORKSPACE_OWNER" as const,
  status: "ACTIVE" as const,
  username: "owner",
};

describe("MailboxesService personal and business rules", () => {
  it("lists personal mailboxes alongside business mailboxes", async () => {
    const service = new MailboxesService(
      null as never,
      null as never,
      {
        mailbox: {
          findMany: async ({ where }: { where: unknown }) => {
            assert.ok(JSON.stringify(where).includes("PERSONAL"));
            assert.ok(JSON.stringify(where).includes("BUSINESS"));
            return [
              { address: "owner@jposta.com", type: MailboxType.PERSONAL },
              { address: "admin@golyvin.com", type: MailboxType.BUSINESS },
            ];
          },
        },
      } as never,
    );

    const mailboxes = await service.list(authUser);

    assert.equal(mailboxes[0]?.type, MailboxType.PERSONAL);
    assert.equal(mailboxes[1]?.type, MailboxType.BUSINESS);
  });

  it("keeps business mailbox creation locked to verified domains", async () => {
    const service = new MailboxesService(
      { createMailbox: async () => undefined } as never,
      { ensureOwnedByUser: async () => ({ id: "org-id" }) } as never,
      {
        domain: {
          findFirst: async () => ({
            id: "domain-id",
            name: "golyvin.com",
            status: DomainStatus.PENDING,
          }),
        },
        mailbox: {
          findUnique: async () => null,
          create: async () => ({ id: "mailbox-id", status: MailboxStatus.PROVISIONING }),
          update: async () => null,
        },
      } as never,
    );

    await assert.rejects(
      () =>
        service.create(
          {
            organizationId: "org-id",
            domainId: "domain-id",
            localPart: "admin",
            displayName: "Admin",
            password: "Strongpass123",
          },
          authUser,
        ),
      BadRequestException,
    );
  });
});
