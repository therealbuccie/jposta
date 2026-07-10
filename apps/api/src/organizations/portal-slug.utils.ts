import { BadRequestException } from "@nestjs/common";

const reservedPortalSlugs = new Set([
  "www",
  "api",
  "admin",
  "mail",
  "smtp",
  "imap",
  "pop",
  "webmail",
  "support",
  "help",
  "billing",
  "status",
  "cdn",
  "assets",
  "static",
  "app",
  "dashboard",
  "login",
  "auth",
  "oauth",
  "security",
  "postmaster",
  "abuse",
  "mta-sts",
  "autoconfig",
  "autodiscover",
]);

const portalSlugPattern = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function normalizePortalSlug(value: string | undefined) {
  const slug = value?.trim().toLowerCase();

  if (!slug) {
    throw new BadRequestException("Portal slug is required.");
  }

  if (slug.length < 3 || slug.length > 40) {
    throw new BadRequestException("Portal slug must be between 3 and 40 characters.");
  }

  if (!portalSlugPattern.test(slug) || slug.includes("--")) {
    throw new BadRequestException(
      "Portal slug must use lowercase letters, numbers, and hyphens, and start and end with a letter or number.",
    );
  }

  if (reservedPortalSlugs.has(slug)) {
    throw new BadRequestException("This portal subdomain is reserved.");
  }

  return slug;
}

export function slugFromOrganizationName(name: string) {
  const compact = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/g, "");

  return normalizePortalSlug(compact || "workspace");
}

export function portalUrl(slug: string) {
  return `https://${slug}.jposta.com`;
}

export function isReservedPortalSlug(value: string) {
  return reservedPortalSlugs.has(value.trim().toLowerCase());
}
