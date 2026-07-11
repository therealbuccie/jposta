import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseResetArgs,
  resetTestOrganization,
  validateSlug,
} from "./reset-test-organization.mjs";

describe("reset-test-organization script", () => {
  it("prints a dry-run summary without deleting rows", async () => {
    const state = createState();
    const output = [];

    const result = await resetTestOrganization({
      prisma: createPrisma(state),
      slug: "golivyn",
      write: (line) => output.push(line),
    });

    assert.equal(result.mode, "dry-run");
    assert.equal(state.organizations.length, 2);
    assert.equal(state.domains.length, 2);
    assert.equal(state.mailboxes.length, 3);
    assert.match(output.join("\n"), /Organization: Golivyn/);
    assert.match(output.join("\n"), /docker exec -it jposta-mailserver setup email del admin@golivyn.com/);
  });

  it("rejects a missing slug", () => {
    assert.throws(() => parseResetArgs([]), /Usage: reset:test-org/);
    assert.throws(() => validateSlug(""), /slug is required/i);
  });

  it("requires --confirm before deleting", async () => {
    const state = createState();

    await resetTestOrganization({
      prisma: createPrisma(state),
      slug: "golivyn",
      confirm: false,
      write: () => undefined,
    });

    assert.ok(state.organizations.some((organization) => organization.slug === "golivyn"));
    assert.ok(state.mailboxes.some((mailbox) => mailbox.address === "admin@golivyn.com"));
  });

  it("protects unrelated organizations and users", async () => {
    const state = createState();

    await resetTestOrganization({
      prisma: createPrisma(state),
      slug: "golivyn",
      confirm: true,
      write: () => undefined,
    });

    assert.equal(state.users.length, 2);
    assert.deepEqual(
      state.organizations.map((organization) => organization.slug),
      ["otherco"],
    );
    assert.deepEqual(
      state.domains.map((domain) => domain.name),
      ["otherco.com"],
    );
    assert.deepEqual(
      state.mailboxes.map((mailbox) => mailbox.address),
      ["hello@otherco.com"],
    );
  });

  it("rolls back the transaction on failure", async () => {
    const state = createState();
    const before = JSON.stringify(state);

    await assert.rejects(
      () =>
        resetTestOrganization({
          prisma: createPrisma(state, { failOnDomainDelete: true }),
          slug: "golivyn",
          confirm: true,
          write: () => undefined,
        }),
      /domain delete failed/,
    );

    assert.equal(JSON.stringify(state), before);
  });

  it("deletes the target organization rows successfully", async () => {
    const state = createState();

    const result = await resetTestOrganization({
      prisma: createPrisma(state),
      slug: "golivyn",
      confirm: true,
      write: () => undefined,
    });

    assert.equal(result.mode, "deleted");
    assert.deepEqual(result.deleted, {
      webmailSessions: 2,
      mailboxes: 2,
      domains: 1,
      organizations: 1,
    });
    assert.equal(state.organizations.some((organization) => organization.slug === "golivyn"), false);
    assert.equal(state.webmailSessions.some((session) => session.organizationId === "org-golivyn"), false);
  });
});

function createState() {
  return {
    users: [
      { id: "user-golivyn", email: "owner@golivyn.com" },
      { id: "user-other", email: "owner@otherco.com" },
    ],
    organizations: [
      { id: "org-golivyn", name: "Golivyn", slug: "golivyn", ownerId: "user-golivyn" },
      { id: "org-other", name: "Other Co", slug: "otherco", ownerId: "user-other" },
    ],
    domains: [
      { id: "domain-golivyn", name: "golivyn.com", status: "VERIFIED", organizationId: "org-golivyn" },
      { id: "domain-other", name: "otherco.com", status: "ACTIVE", organizationId: "org-other" },
    ],
    mailboxes: [
      { id: "mailbox-admin", address: "admin@golivyn.com", status: "ACTIVE", organizationId: "org-golivyn" },
      { id: "mailbox-info", address: "info@golivyn.com", status: "ACTIVE", organizationId: "org-golivyn" },
      { id: "mailbox-other", address: "hello@otherco.com", status: "ACTIVE", organizationId: "org-other" },
    ],
    webmailSessions: [
      { id: "session-admin", mailboxId: "mailbox-admin", portalSlug: "golivyn", organizationId: "org-golivyn", revokedAt: null },
      { id: "session-info", mailboxId: "mailbox-info", portalSlug: "golivyn", organizationId: "org-golivyn", revokedAt: null },
      { id: "session-other", mailboxId: "mailbox-other", portalSlug: "otherco", organizationId: "org-other", revokedAt: null },
    ],
  };
}

function createPrisma(state, options = {}) {
  const delegates = createDelegates(state, options);
  return {
    ...delegates,
    $transaction: async (callback) => {
      const snapshot = cloneState(state);
      const tx = createDelegates(state, options);
      try {
        return await callback(tx);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
  };
}

function createDelegates(state, options) {
  return {
    organization: {
      findUnique: async ({ where }) => {
        const organization = state.organizations.find((item) => item.slug === where.slug);
        if (!organization) return null;
        return {
          ...organization,
          domains: state.domains
            .filter((domain) => domain.organizationId === organization.id)
            .sort((a, b) => a.name.localeCompare(b.name)),
          mailboxes: state.mailboxes
            .filter((mailbox) => mailbox.organizationId === organization.id)
            .sort((a, b) => a.address.localeCompare(b.address)),
          webmailSessions: state.webmailSessions.filter(
            (session) => session.organizationId === organization.id,
          ),
        };
      },
      delete: async ({ where }) => {
        const index = state.organizations.findIndex((item) => item.id === where.id);
        if (index === -1) throw new Error("organization not found");
        const [deleted] = state.organizations.splice(index, 1);
        return deleted;
      },
    },
    webmailSession: {
      deleteMany: async ({ where }) => deleteMany(state.webmailSessions, where),
    },
    mailbox: {
      deleteMany: async ({ where }) => deleteMany(state.mailboxes, where),
    },
    domain: {
      deleteMany: async ({ where }) => {
        if (options.failOnDomainDelete) throw new Error("domain delete failed");
        return deleteMany(state.domains, where);
      },
    },
  };
}

function deleteMany(rows, where) {
  const before = rows.length;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (Object.entries(where).every(([key, value]) => rows[index][key] === value)) {
      rows.splice(index, 1);
    }
  }
  return { count: before - rows.length };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
