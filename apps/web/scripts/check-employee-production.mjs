import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const employeeDir = path.resolve(process.cwd(), "app", "employee");
const libDir = path.resolve(process.cwd(), "lib");
const scanRoots = [employeeDir, libDir];
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
    const filePath = path.join(directory, entry);
    if (statSync(filePath).isDirectory()) {
      walk(filePath);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(path)) continue;
    const source = readFileSync(filePath, "utf8");
    for (const term of blocked) {
      if (source.includes(term)) failures.push(`${filePath}: contains ${term}`);
    }
  }
}

for (const directory of scanRoots) walk(directory);

if (failures.length) {
  console.error("Employee production content check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}


