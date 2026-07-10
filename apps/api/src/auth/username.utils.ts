import { BadRequestException } from "@nestjs/common";

export const platformDomain = "jposta.com";

const reservedUsernames = new Set([
  "admin",
  "administrator",
  "support",
  "billing",
  "security",
  "mail",
  "postmaster",
  "abuse",
  "root",
  "api",
  "help",
  "sales",
  "info",
  "contact",
  "webmaster",
  "system",
  "noreply",
  "no-reply",
  "mailer-daemon",
  "hostmaster",
]);

const shellMetacharacters = /[;&|`$<>\\!(){}[\]*?~'"\s]/;
const usernamePattern = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;

export function normalizeUsername(value: string | undefined) {
  const username = value?.trim().toLowerCase();

  if (!username) {
    throw new BadRequestException("Username is required.");
  }

  if (username.length < 3 || username.length > 30) {
    throw new BadRequestException("Username must be between 3 and 30 characters.");
  }

  if (shellMetacharacters.test(username)) {
    throw new BadRequestException("Username contains unsupported characters.");
  }

  if (!usernamePattern.test(username)) {
    throw new BadRequestException(
      "Username must start with a letter or number and may contain dots, underscores, or hyphens.",
    );
  }

  if (username.includes("..")) {
    throw new BadRequestException("Username cannot contain consecutive dots.");
  }

  if (reservedUsernames.has(username)) {
    throw new BadRequestException("This username is reserved.");
  }

  return username;
}

export function primaryEmailForUsername(username: string) {
  return `${username}@${platformDomain}`;
}

export function normalizeLoginIdentifier(value: string | undefined) {
  const identifier = value?.trim().toLowerCase();

  if (!identifier) {
    throw new BadRequestException("JPosta username or email is required.");
  }

  if (identifier.includes("@")) {
    return identifier;
  }

  return primaryEmailForUsername(normalizeUsername(identifier));
}

export function normalizeOptionalRecoveryEmail(value: string | undefined, primaryEmail: string) {
  const email = value?.trim().toLowerCase();

  if (!email) {
    return null;
  }

  if (!email.includes("@")) {
    throw new BadRequestException("Recovery email must be a valid email address.");
  }

  if (email === primaryEmail) {
    throw new BadRequestException("Recovery email must be different from your JPosta address.");
  }

  return email;
}

export function usernameSuggestions(username: string, unavailable: Set<string>) {
  const base = username.replace(/[^a-z0-9._-]/g, "").replace(/[._-]+$/g, "") || "user";
  const candidates = [
    `${base}${new Date().getFullYear()}`,
    `${base}.mail`,
    `${base}_hq`,
    `${base}-${Math.floor(100 + Math.random() * 900)}`,
  ];

  return candidates
    .map((candidate) => {
      try {
        return normalizeUsername(candidate);
      } catch {
        return null;
      }
    })
    .filter(
      (candidate): candidate is string =>
        typeof candidate === "string" && !unavailable.has(candidate),
    )
    .slice(0, 3);
}
