import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "./auth.types";

const scrypt = promisify(scryptCallback);
const tokenTtlSeconds = 60 * 60 * 24 * 7;

type RegisterInput = {
  email?: string;
  name?: string;
  password?: string;
};

type LoginInput = {
  email?: string;
  password?: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterInput) {
    const email = normalizeEmail(input.email);
    const name = requireText(input.name, "name");
    const password = requirePassword(input.password);
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new ConflictException("A user with this email already exists.");
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
      },
      select: userSelect,
    });

    return {
      user,
      token: this.signToken(user),
    };
  }

  async login(input: LoginInput) {
    const email = normalizeEmail(input.email);
    const password = requirePassword(input.password);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const publicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    return {
      user: publicUser,
      token: this.signToken(publicUser),
    };
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
      sub?: string;
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
    };
  }

  private signToken(user: AuthenticatedUser) {
    const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const encodedPayload = base64UrlEncode(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        name: user.name,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
      }),
    );

    return `${encodedHeader}.${encodedPayload}.${sign(`${encodedHeader}.${encodedPayload}`)}`;
  }
}

const userSelect = {
  id: true,
  email: true,
  name: true,
} as const;

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

function normalizeEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new BadRequestException("A valid email is required.");
  }

  return email;
}

function requirePassword(value: string | undefined) {
  if (!value || value.length < 8) {
    throw new BadRequestException("Password must be at least 8 characters.");
  }

  return value;
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
