// Scans public bundles + HTML for persona names that must not appear in public product copy.
// Allowlist: quarantine/, safety host blocklists, and the ban-list test files themselves.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BANNED = /\b(QLA|Queen Lady Alpha|Lady Alpha|Aletheia|Scorpus)\b/i;
const SKIP_DIRS = new Set([".git", "node_modules", "quarantine", "safety"]);
const ALLOW = new Set(["desktop/js/kb-docs.test.js", "desktop/js/public-persona-scan.test.js"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}
const targets = [];
for (const name of readdirSync(join(root, "assets"))) if (name.endsWith(".js")) targets.push(join(root, "assets", name));
for (const name of readdirSync(root)) if (name.endsWith(".html")) targets.push(join(root, name));
for (const sub of ["website", "desktop"]) {
  try { for (const p of walk(join(root, sub))) if (/\.(html|js|mjs)$/.test(p)) targets.push(p); } catch {}
}
const hits = [];
for (const p of targets) {
  const rel = relative(root, p);
  if (ALLOW.has(rel)) continue;
  readFileSync(p, "utf8").split("\n").forEach((line, i) => {
    const m = line.match(BANNED);
    if (m) hits.push(`${rel}:${i + 1}: ${m[0]}`);
  });
}
if (hits.length) {
  console.error("Banned persona names in public files:\n" + hits.join("\n"));
  process.exit(1);
}
console.log(`public-persona-scan ok (${targets.length} files)`);
