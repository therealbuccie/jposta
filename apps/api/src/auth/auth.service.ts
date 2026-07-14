import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { MailboxStatus, MailboxType, UserRole, UserStatus } from "@prisma/client";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { MailProvisioningService } from "../mail-provisioning/mail-provisioning.service";
import { env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "./auth.types";
import { FixedWindowRateLimiter } from "./rate-limit";
import {
  normalizeLoginIdentifier,
  normalizeOptionalRecoveryEmail,
  normalizeUsername,
  platformDomain,
  primaryEmailForUsername,
  usernameSuggestions,
} from "./username.utils";

const scrypt = promisify(scryptCallback);
const tokenTtlSeconds = 60 * 60 * 24 * 7;
const authLimiter = new FixedWindowRateLimiter(12, 60_000, "authentication");
const availabilityLimiter = new FixedWindowRateLimiter(60, 60_000, "username availability");

type RegisterInput = {
  confirmPassword?: string;
  fullName?: string;
  password?: string;
  recoveryEmail?: string;
  username?: string;
};

type LoginInput = {
  identifier?: string;
  password?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailProvisioningService: MailProvisioningService,
  ) {}

  async usernameAvailability(usernameValue: string | undefined, rateLimitKey = "anonymous") {
    availabilityLimiter.check(rateLimitKey);
    const normalizedUsername = normalizeUsername(usernameValue);
    const email = primaryEmailForUsername(normalizedUsername);
    const unavailableUsernames = new Set<string>();
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: normalizedUsername }, { primaryEmail: email }, { email }],
      },
      select: { username: true },
    });

    if (existing?.username) {
      unavailableUsernames.add(existing.username);
    }

    const available = !existing;

    return {
      normalizedUsername,
      email,
      available,
      suggestions: available ? [] : usernameSuggestions(normalizedUsername, unavailableUsernames),
    };
  }

  async register(input: RegisterInput, rateLimitKey = "anonymous") {
    authLimiter.check(`register:${rateLimitKey}`);
    const fullName = requireText(input.fullName, "fullName");
    const username = normalizeUsername(input.username);
    const primaryEmail = primaryEmailForUsername(username);
    const recoveryEmail = normalizeOptionalRecoveryEmail(input.recoveryEmail, primaryEmail);
    const password = requireStrongPassword(input.password);

    if (password !== input.confirmPassword) {
      throw new BadRequestException("Passwords do not match.");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { primaryEmail }, { email: primaryEmail }],
      },
      select: {
        id: true,
        passwordHash: true,
        status: true,
      },
    });

    if (existingUser) {
      if (
        (existingUser.status === UserStatus.FAILED ||
          existingUser.status === UserStatus.PENDING_PROVISIONING) &&
        (await verifyPassword(password, existingUser.passwordHash))
      ) {
        const resumedUser = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: fullName,
            recoveryEmail,
            status: UserStatus.PENDING_PROVISIONING,
          },
          select: userSelect,
        });

        return this.authResponse(resumedUser);
      }

      throw new ConflictException("This JPosta username is already taken.");
    }

    const passwordHash = await hashPassword(password);
    const user = await this.prisma.user.create({
      data: {
        email: primaryEmail,
        username,
        primaryEmail,
        recoveryEmail,
        name: fullName,
        passwordHash,
        status: UserStatus.PENDING_PROVISIONING,
        role: UserRole.USER,
      },
      select: userSelect,
    });

    const mailbox = await this.prisma.mailbox.create({
      data: {
        address: primaryEmail,
        displayName: fullName,
        type: MailboxType.PERSONAL,
        status: MailboxStatus.PROVISIONING,
        quotaMb: 5120,
        userId: user.id,
      },
    });

    try {
      // MVP note: the account password and initial mailbox password are intentionally sourced
      // from the same secret here, but they are logically separate credentials and should be
      // split into independent password flows before production-grade mailbox access ships.
      await this.mailProvisioningService.createMailbox({
        address: primaryEmail,
        password,
        quotaMb: mailbox.quotaMb,
      });

      const nextStatus = recoveryEmail ? UserStatus.PENDING_VERIFICATION : UserStatus.ACTIVE;
      const activatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          personalMailboxId: mailbox.id,
          status: nextStatus,
        },
        select: userSelect,
      });

      await this.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: {
          status: MailboxStatus.ACTIVE,
          provisioningError: null,
        },
      });

      return this.authResponse(activatedUser);
    } catch (error) {
      const provisioningError = error instanceof Error ? error.message : "Provisioning failed.";
      await this.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: {
          status: MailboxStatus.FAILED,
          provisioningError,
        },
      });
      const pendingUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          personalMailboxId: mailbox.id,
          status: UserStatus.PENDING_PROVISIONING,
        },
        select: userSelect,
      });

      return this.authResponse(pendingUser);
    }
  }

  async login(input: LoginInput, rateLimitKey = "anonymous") {
    authLimiter.check(`login:${rateLimitKey}`);
    const identifier = normalizeLoginIdentifier(input.identifier);
    const password = requirePassword(input.password);
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ primaryEmail: identifier }, { email: identifier }],
      },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid username or password.");
    }

    if (user.status === UserStatus.FAILED || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException("Account is not available for login.");
    }

    return this.authResponse(toPublicUser(user));
  }

  verifyToken(token: string): AuthenticatedUser {
    const [encodedHeader, encodedPayload, signature] = token.split(".");

    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException("Invalid token.");
    }

    const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);

    if (!safeEquals(signature, expectedSignature)) {
      throw new UnauthorizedException("Invalid token.");
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as {
      email?: string;
      exp?: number;
      name?: string;
      primaryEmail?: string;
      role?: UserRole;
      status?: UserStatus;
      sub?: string;
      username?: string;
    };

    if (
      !payload.sub ||
      !payload.email ||
      !payload.name ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException("Token expired or invalid.");
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      primaryEmail: payload.primaryEmail ?? payload.email,
      role: payload.role ?? UserRole.USER,
      status: payload.status ?? UserStatus.ACTIVE,
      username: payload.username ?? payload.email.split("@")[0] ?? "user",
    };
  }

  private authResponse(user: PublicUser) {
    const token = this.signToken(user);

    return {
      user,
      token,
      accessToken: token,
      accountStatus: user.status,
      primaryEmail: user.primaryEmail,
      warning:
        user.status === UserStatus.PENDING_VERIFICATION
          ? "Recovery email verification is pending."
          : user.status === UserStatus.PENDING_PROVISIONING
            ? "Your account is ready, but mailbox provisioning is still pending."
            : undefined,
    };
  }

  private signToken(user: PublicUser) {
    const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const encodedPayload = base64UrlEncode(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        primaryEmail: user.primaryEmail,
        role: user.role,
        status: user.status,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
      }),
    );

    return `${encodedHeader}.${encodedPayload}.${sign(`${encodedHeader}.${encodedPayload}`)}`;
  }
}

type PublicUser = {
  email: string;
  id: string;
  name: string;
  primaryEmail: string;
  role: UserRole;
  status: UserStatus;
  username: string;
};

const userSelect = {
  email: true,
  id: true,
  name: true,
  primaryEmail: true,
  role: true,
  status: true,
  username: true,
} as const;

function toPublicUser(user: {
  email: string;
  id: string;
  name: string;
  primaryEmail: string;
  role: UserRole;
  status: UserStatus;
  username: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    primaryEmail: user.primaryEmail,
    role: user.role,
    status: user.status,
  };
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const candidate = (await scrypt(password, salt, 64)) as Buffer;
  const original = Buffer.from(hash, "hex");

  return original.length === candidate.length && timingSafeEqual(original, candidate);
}

function requirePassword(value: string | undefined) {
  if (!value) {
    throw new BadRequestException("Password is required.");
  }

  return value;
}

function requireStrongPassword(value: string | undefined) {
  const password = requirePassword(value);

  if (password.length < 10 || !/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    throw new BadRequestException(
      "Password must be at least 10 characters and include a letter and number.",
    );
  }

  return password;
}

function requireText(value: string | undefined, field: string) {
  const text = value?.trim();

  if (!text) {
    throw new BadRequestException(`${field} is required.`);
  }

  return text;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url");
}

function sign(value: string) {
  return createHmac("sha256", env.jwtSecret).update(value).digest("base64url");
}

function safeEquals(value: string, expected: string) {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export { platformDomain };
