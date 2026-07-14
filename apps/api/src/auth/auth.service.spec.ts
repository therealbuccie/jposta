import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { MailboxStatus, MailboxType, UserRole, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { AuthService } from "./auth.service";

type UserRow = {
  email: string;
  id: string;
  name: string;
  passwordHash: string;
  personalMailboxId?: string | null;
  primaryEmail: string;
  recoveryEmail?: string | null;
  role: UserRole;
  status: UserStatus;
  username: string;
};

type MailboxRow = {
  address: string;
  displayName: string;
  id: string;
  provisioningError?: string | null;
  quotaMb: number;
  status: MailboxStatus;
  type: MailboxType;
  userId?: string | null;
};

describe("AuthService identity auth", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-tests";
  });

  it("reports username availability", async () => {
    const state = createState();
    const service = createService(state);

    assert.deepEqual(await service.usernameAvailability("Onyebuchi", "availability-a"), {
      normalizedUsername: "onyebuchi",
      email: "onyebuchi@jposta.com",
      available: true,
      suggestions: [],
    });
  });

  it("returns suggestions when a username is unavailable", async () => {
    const state = createState();
    state.users.push(existingUser({ username: "onyebuchi", primaryEmail: "onyebuchi@jposta.com" }));
    const service = createService(state);

    const result = await service.usernameAvailability("onyebuchi", "availability-b");

    assert.equal(result.available, false);
    assert.equal(result.email, "onyebuchi@jposta.com");
    assert.ok(result.suggestions.length > 0);
  });

  it("registers a user, provisions a personal mailbox, and returns auth tokens", async () => {
    const state = createState();
    const provisioned: string[] = [];
    const service = createService(state, {
      createMailbox: async (input) => {
        provisioned.push(input.address);
      },
    });

    const result = await service.register(
      {
        fullName: "Onyebuchi Okeke",
        username: "onyebuchi",
        password: "Strongpass123",
        confirmPassword: "Strongpass123",
      },
      "register-success",
    );

    assert.equal(result.user.primaryEmail, "onyebuchi@jposta.com");
    assert.equal(result.user.status, UserStatus.ACTIVE);
    assert.equal(result.user.role, UserRole.USER);
    assert.equal(typeof result.token, "string");
    assert.equal(result.accessToken, result.token);
    assert.deepEqual(provisioned, ["onyebuchi@jposta.com"]);
    assert.equal(state.mailboxes[0]?.type, MailboxType.PERSONAL);
    assert.equal(state.mailboxes[0]?.status, MailboxStatus.ACTIVE);
  });

  it("creates a usable pending account when mailbox provisioning fails", async () => {
    const state = createState();
    const service = createService(state, {
      createMailbox: async () => {
        throw new ServiceUnavailableException("Provisioner down.");
      },
    });

    const result = await service.register(
      {
        fullName: "Pending User",
        username: "pendinguser",
        password: "Strongpass123",
        confirmPassword: "Strongpass123",
      },
      "register-failure",
    );

    assert.equal(result.user.status, UserStatus.PENDING_PROVISIONING);
    assert.equal(
      result.warning,
      "Your account is ready, but mailbox provisioning is still pending.",
    );
    assert.equal(state.users[0]?.status, UserStatus.PENDING_PROVISIONING);
    assert.equal(state.mailboxes[0]?.status, MailboxStatus.FAILED);
    assert.match(state.mailboxes[0]?.provisioningError ?? "", /Provisioner down/);

    const login = await service.login(
      { identifier: "pendinguser", password: "Strongpass123" },
      "login-pending",
    );
    assert.equal(login.user.status, UserStatus.PENDING_PROVISIONING);
  });

  it("resumes a stranded signup only when the original password is supplied", async () => {
    const state = createState();
    const service = createService(state, {
      createMailbox: async () => {
        throw new ServiceUnavailableException("Provisioner down.");
      },
    });

    await service.register(
      {
        fullName: "Stranded User",
        username: "strandeduser",
        password: "Strongpass123",
        confirmPassword: "Strongpass123",
      },
      "register-stranded",
    );
    state.users[0]!.status = UserStatus.FAILED;

    const resumed = await service.register(
      {
        fullName: "Stranded User",
        username: "strandeduser",
        password: "Strongpass123",
        confirmPassword: "Strongpass123",
      },
      "register-resumed",
    );

    assert.equal(resumed.user.status, UserStatus.PENDING_PROVISIONING);
    assert.equal(state.users.length, 1);
    assert.equal(state.mailboxes.length, 1);
  });

  it("logs in with username and full primary email", async () => {
    const state = createState();
    const service = createService(state);

    await service.register(
      {
        fullName: "Login User",
        username: "loginuser",
        password: "Strongpass123",
        confirmPassword: "Strongpass123",
      },
      "register-login",
    );

    const byUsername = await service.login(
      { identifier: "loginuser", password: "Strongpass123" },
      "login-username",
    );
    const byEmail = await service.login(
      { identifier: "loginuser@jposta.com", password: "Strongpass123" },
      "login-email",
    );

    assert.equal(byUsername.primaryEmail, "loginuser@jposta.com");
    assert.equal(byEmail.primaryEmail, "loginuser@jposta.com");
  });

  it("allows pending verification with a warning and rejects suspended accounts", async () => {
    const state = createState();
    const service = createService(state);

    const pending = await service.register(
      {
        fullName: "Verify User",
        username: "verifyuser",
        password: "Strongpass123",
        confirmPassword: "Strongpass123",
        recoveryEmail: "verify@example.com",
      },
      "register-pending",
    );

    assert.equal(pending.accountStatus, UserStatus.PENDING_VERIFICATION);
    assert.equal(pending.warning, "Recovery email verification is pending.");

    state.users[0]!.status = UserStatus.SUSPENDED;

    await assert.rejects(
      () =>
        service.login({ identifier: "verifyuser", password: "Strongpass123" }, "login-suspended"),
      UnauthorizedException,
    );
  });
});

function createState() {
  return {
    users: [] as UserRow[],
    mailboxes: [] as MailboxRow[],
  };
}

function existingUser(input: Partial<UserRow>): UserRow {
  return {
    id: input.id ?? "user-existing",
    email: input.email ?? input.primaryEmail ?? "existing@jposta.com",
    username: input.username ?? "existing",
    primaryEmail: input.primaryEmail ?? input.email ?? "existing@jposta.com",
    recoveryEmail: null,
    name: input.name ?? "Existing User",
    passwordHash: input.passwordHash ?? "salt:hash",
    personalMailboxId: null,
    role: input.role ?? UserRole.USER,
    status: input.status ?? UserStatus.ACTIVE,
  };
}

function createService(
  state: ReturnType<typeof createState>,
  provisioner: {
    createMailbox?: (input: {
      address: string;
      password: string;
      quotaMb: number;
    }) => Promise<void>;
  } = {},
) {
  const prisma = {
    user: {
      findFirst: async ({ where }: { where: { OR?: Partial<UserRow>[] } }) =>
        state.users.find((user) =>
          where.OR?.some((condition) =>
            Object.entries(condition).every(([key, value]) => user[key as keyof UserRow] === value),
          ),
        ) ?? null,
      create: async ({ data }: { data: Omit<UserRow, "id"> }) => {
        const user = { ...data, id: `user-${state.users.length + 1}` } as UserRow;
        state.users.push(user);
        return publicUser(user);
      },
      update: async ({ data, where }: { data: Partial<UserRow>; where: { id: string } }) => {
        const user = state.users.find((item) => item.id === where.id);
        if (!user) throw new Error("Missing user");
        Object.assign(user, data);
        return publicUser(user);
      },
    },
    mailbox: {
      create: async ({ data }: { data: Omit<MailboxRow, "id"> }) => {
        const mailbox = { ...data, id: `mailbox-${state.mailboxes.length + 1}` } as MailboxRow;
        state.mailboxes.push(mailbox);
        return mailbox;
      },
      update: async ({ data, where }: { data: Partial<MailboxRow>; where: { id: string } }) => {
        const mailbox = state.mailboxes.find((item) => item.id === where.id);
        if (!mailbox) throw new Error("Missing mailbox");
        Object.assign(mailbox, data);
        return mailbox;
      },
    },
  };

  return new AuthService(
    prisma as never,
    {
      createMailbox: provisioner.createMailbox ?? (async () => undefined),
    } as never,
  );
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    primaryEmail: user.primaryEmail,
    role: user.role,
    status: user.status,
    username: user.username,
  };
}
