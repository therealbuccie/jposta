import { MailboxStatus, MailboxType, PortalStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { WebmailService } from "./webmail.service";

describe("WebmailService", () => {
  beforeEach(() => {
    process.env.WEBMAIL_CREDENTIAL_ENCRYPTION_SECRET = "test-webmail-secret-with-at-least-32-chars";
    process.env.JWT_SECRET = "test-jwt-secret-with-at-least-32-characters";
  });

  it("logs in an active business mailbox through the correct portal", async () => {
    const state = createState();
    const service = createService(state);

    const result = await service.login({
      email: "INFO@GOLIVYN.COM",
      password: "Mailboxpass123",
      portalSlug: "golivyn",
    });

    assert.equal(result.redirectTo, "/employee");
    assert.equal(result.mailbox.address, "info@golivyn.com");
    assert.equal(result.portal.slug, "golivyn");
    assert.ok(result.webmailSessionToken.length > 32);
    assert.notEqual(state.sessions[0]?.tokenHash, result.webmailSessionToken);
  });

  it("rejects mailboxes from another organization", async () => {
    const state = createState();
    state.mailboxes[0]!.organizationId = "other-org";
    const service = createService(state);

    await assert.rejects(() =>
      service.login({
        email: "info@golivyn.com",
        password: "Mailboxpass123",
        portalSlug: "golivyn",
      }),
    );
  });

  it("rejects inactive mailboxes and bad passwords generically", async () => {
    const state = createState();
    state.mailboxes[0]!.status = MailboxStatus.SUSPENDED;
    await assert.rejects(() =>
      createService(state).login({
        email: "info@golivyn.com",
        password: "Mailboxpass123",
        portalSlug: "golivyn",
      }),
    );

    const activeState = createState();
    await assert.rejects(() =>
      createService(activeState, false).login({
        email: "info@golivyn.com",
        password: "wrong",
        portalSlug: "golivyn",
      }),
    );
  });

  it("returns /webmail/me data and revokes logout", async () => {
    const state = createState();
    const service = createService(state);
    const login = await service.login({
      email: "info@golivyn.com",
      password: "Mailboxpass123",
      portalSlug: "golivyn",
    });

    const me = await service.me(login.webmailSessionToken);
    assert.equal(me.mailbox.address, "info@golivyn.com");
    assert.equal(me.portal.slug, "golivyn");

    await service.logout(login.webmailSessionToken);
    assert.ok(state.sessions[0]?.revokedAt);
    await assert.rejects(() => service.me(login.webmailSessionToken));
  });

  it("rejects expired sessions", async () => {
    const state = createState();
    const service = createService(state);
    const login = await service.login({
      email: "info@golivyn.com",
      password: "Mailboxpass123",
      portalSlug: "golivyn",
    });
    state.sessions[0]!.expiresAt = new Date(Date.now() - 1000);

    await assert.rejects(() => service.me(login.webmailSessionToken));
  });
});

function createState() {
  return {
    organization: {
      id: "org-id",
      name: "Golivyn",
      slug: "golivyn",
      mailPortalEnabled: true,
      portalStatus: PortalStatus.ACTIVE as PortalStatus,
      portalDisplayName: "Golivyn Mail",
      portalLogoUrl: null,
    },
    mailboxes: [
      {
        id: "mailbox-id",
        address: "info@golivyn.com",
        displayName: "Info",
        organizationId: "org-id",
        status: MailboxStatus.ACTIVE as MailboxStatus,
        type: MailboxType.BUSINESS as MailboxType,
      },
    ],
    sessions: [] as Array<Record<string, any>>,
  };
}

function createService(state: ReturnType<typeof createState>, imapPasses = true) {
  const prisma = {
    organization: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        state.organization.slug === where.slug &&
        state.organization.mailPortalEnabled === where.mailPortalEnabled &&
        state.organization.portalStatus === where.portalStatus
          ? state.organization
          : null,
    },
    mailbox: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        state.mailboxes.find(
          (mailbox) =>
            mailbox.address === where.address &&
            mailbox.organizationId === where.organizationId &&
            mailbox.status === where.status &&
            mailbox.type === where.type,
        ) ?? null,
    },
    webmailSession: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const session = {
          ...data,
          id: `session-${state.sessions.length + 1}`,
          mailbox: state.mailboxes[0],
          organization: state.organization,
        };
        state.sessions.push(session);
        return session;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        state.sessions.find((session) => session.tokenHash === where.tokenHash) ?? null,
      update: async ({ data, where }: { data: Record<string, unknown>; where: { id: string } }) => {
        const session = state.sessions.find((item) => item.id === where.id)!;
        Object.assign(session, data);
        return session;
      },
      updateMany: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>;
        where: { tokenHash: string };
      }) => {
        for (const session of state.sessions) {
          if (session.tokenHash === where.tokenHash) Object.assign(session, data);
        }
        return { count: 1 };
      },
    },
  };

  return new WebmailService(
    {
      authenticate: async () => (imapPasses ? undefined : Promise.reject(new Error("bad"))),
    } as never,
    prisma as never,
  );
}
