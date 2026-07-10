export type HostContext =
  | { kind: "main" }
  | { kind: "admin" }
  | { kind: "api" }
  | { kind: "portal"; slug: string };

const reservedHosts = new Set(["www", "admin", "api"]);

export function detectHostContext(hostname: string, search = ""): HostContext {
  const portalParam = new URLSearchParams(search).get("portal");

  if (portalParam) {
    return { kind: "portal", slug: normalizePortalSlug(portalParam) };
  }

  const host = hostname.toLowerCase().split(":")[0] ?? "";

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "jposta.com" ||
    host === "www.jposta.com"
  ) {
    return { kind: "main" };
  }

  if (host === "admin.jposta.com") return { kind: "admin" };
  if (host === "api.jposta.com") return { kind: "api" };

  if (host.endsWith(".localhost")) {
    return { kind: "portal", slug: normalizePortalSlug(host.replace(/\.localhost$/, "")) };
  }

  if (host.endsWith(".jposta.com")) {
    const slug = host.replace(/\.jposta\.com$/, "");
    if (!reservedHosts.has(slug)) {
      return { kind: "portal", slug: normalizePortalSlug(slug) };
    }
  }

  return { kind: "main" };
}

function normalizePortalSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}
