import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

const reservedSlugs = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "dashboard",
  "domains",
  "employee",
  "help",
  "jposta",
  "login",
  "mail",
  "mailboxes",
  "platform",
  "root",
  "settings",
  "support",
  "system",
  "webmail",
  "www",
]);

export function parseResetArgs(argv) {
  const args = [...argv];
  const confirm = args.includes("--confirm");
  const slug = args.find((arg) => !arg.startsWith("--"));

  if (!slug) throw new Error("Usage: reset:test-org <slug> [--confirm]");
  validateSlug(slug);

  return { slug: slug.trim().toLowerCase(), confirm };
}

export function validateSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (!slug) throw new Error("Organization slug is required.");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
    throw new Error(`Refusing unsafe organization slug: ${value}`);
  }
  if (reservedSlugs.has(slug)) throw new Error(`Refusing reserved organization slug: ${slug}`);
  return slug;
}

export async function loadResetSummary(prisma, slug) {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    include: {
      domains: {
        select: { id: true, name: true, status: true },
        orderBy: { name: "asc" },
      },
      mailboxes: {
        select: { id: true, address: true, status: true },
        orderBy: { address: "asc" },
      },
      webmailSessions: {
        select: { id: true, mailboxId: true, portalSlug: true, revokedAt: true },
      },
    },
  });

  if (!organization) {
    return {
      found: false,
      slug,
      organization: null,
      domains: [],
      mailboxes: [],
      webmailSessions: [],
    };
  }

  return {
    found: true,
    slug,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      ownerId: organization.ownerId,
    },
    domains: organization.domains,
    mailboxes: organization.mailboxes,
    webmailSessions: organization.webmailSessions,
  };
}

export function formatResetSummary(summary) {
  const lines = [];
  lines.push("JPosta Test Organization Reset");
  lines.push("");
  lines.push(`Slug: ${summary.slug}`);

  if (!summary.found) {
    lines.push("Organization: not found");
    lines.push("No rows will be deleted.");
    return lines.join("\n");
  }

  lines.push(`Organization: ${summary.organization.name} (${summary.organization.id})`);
  lines.push(`Domains: ${summary.domains.length}`);
  for (const domain of summary.domains) lines.push(`  - ${domain.name} [${domain.status}]`);
  lines.push(`Mailboxes: ${summary.mailboxes.length}`);
  for (const mailbox of summary.mailboxes) lines.push(`  - ${mailbox.address} [${mailbox.status}]`);
  lines.push(`Webmail sessions: ${summary.webmailSessions.length}`);
  lines.push("");
  lines.push("Docker Mailserver cleanup is manual. Run these safe commands on the mail server if needed:");
  if (summary.mailboxes.length) {
    for (const mailbox of summary.mailboxes) {
      lines.push(`  docker exec -it jposta-mailserver setup email del ${mailbox.address}`);
    }
  } else {
    lines.push("  No mailbox cleanup commands required.");
  }

  return lines.join("\n");
}

export async function resetTestOrganization({ prisma, slug: rawSlug, confirm = false, write = console.log }) {
  const slug = validateSlug(rawSlug);
  const summary = await loadResetSummary(prisma, slug);
  write(formatResetSummary(summary));

  if (!summary.found) {
    return { mode: "not-found", summary, deleted: null };
  }

  if (!confirm) {
    write("");
    write("Dry run only. Re-run with --confirm to delete these rows.");
    return { mode: "dry-run", summary, deleted: null };
  }

  const organizationId = summary.organization.id;
  const deleted = await prisma.$transaction(async (tx) => {
    const webmailSessions = await tx.webmailSession.deleteMany({ where: { organizationId } });
    const mailboxes = await tx.mailbox.deleteMany({ where: { organizationId } });
    const domains = await tx.domain.deleteMany({ where: { organizationId } });
    await tx.organization.delete({ where: { id: organizationId } });
    return {
      webmailSessions: webmailSessions.count,
      mailboxes: mailboxes.count,
      domains: domains.count,
      organizations: 1,
    };
  });

  write("");
  write("Reset completed successfully.");
  write(`Deleted webmail sessions: ${deleted.webmailSessions}`);
  write(`Deleted mailboxes: ${deleted.mailboxes}`);
  write(`Deleted domains: ${deleted.domains}`);
  write(`Deleted organizations: ${deleted.organizations}`);
  write("Users were not deleted. Unrelated organizations were not touched.");

  return { mode: "deleted", summary, deleted };
}

export async function main(argv = process.argv.slice(2)) {
  const { slug, confirm } = parseResetArgs(argv);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const prisma = new PrismaClient();
  try {
    await resetTestOrganization({ prisma, slug, confirm });
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
