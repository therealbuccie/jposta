import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\//, "");
const scanRoots = [join(root, "app", "employee"), join(root, "lib")];
const blocked = [
  ["Alex", " Rivera"],
  ["Maya", " Chen"],
  ["Caleb", " Stone"],
  ["36t", ".studio"],
  ["placeholder", "-only"],
  ["mock", "Messages"],
  ["sample", "Messages"],
  ["demo", "Messages"],
  ["fake", "Inbox"],
  ["Webmail", " Core"],
].map((parts) => parts.join(""));
const failures = [];

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(path)) continue;
    const source = readFileSync(path, "utf8");
    for (const term of blocked) {
      if (source.includes(term)) failures.push(`${path}: contains ${term}`);
    }
  }
}

for (const directory of scanRoots) walk(directory);

if (failures.length) {
  console.error("Employee production content check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
