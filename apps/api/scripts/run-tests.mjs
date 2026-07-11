import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(appRoot, "src");
const distRoot = join(appRoot, "dist");
const scriptsRoot = join(appRoot, "scripts");
const files = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (path.endsWith(".spec.ts")) {
      const compiled = join(distRoot, relative(srcRoot, path)).replace(/\.ts$/, ".js");
      if (existsSync(compiled)) files.push(compiled);
    }
  }
}

walk(srcRoot);
for (const entry of readdirSync(scriptsRoot)) {
  const path = join(scriptsRoot, entry);
  if (statSync(path).isFile() && path.endsWith(".spec.mjs")) files.push(path);
}

if (!files.length) {
  console.error("No compiled spec files found. Run pnpm --filter @jposta/api build first.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  env: {
    ...process.env,
    JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-with-at-least-32-characters",
    DOMAIN_KEY_ENCRYPTION_SECRET:
      process.env.DOMAIN_KEY_ENCRYPTION_SECRET ?? "test-domain-secret-with-at-least-32-chars",
    WEBMAIL_CREDENTIAL_ENCRYPTION_SECRET:
      process.env.WEBMAIL_CREDENTIAL_ENCRYPTION_SECRET ??
      "test-webmail-secret-with-at-least-32-chars",
  },
});
process.exit(result.status ?? 1);

