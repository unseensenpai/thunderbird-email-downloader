// Copy the web-ext .zip artifact to a .xpi alongside it.
// ATN accepts .xpi (and .zip); .xpi is conventional for Thunderbird.
// Run via: npm run build:xpi   (build must have produced the .zip first)

import { readdirSync, statSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(__dirname, "..", "web-ext-artifacts");

// Pick the most recently modified .zip so stale artifacts from older
// versions in the directory can't be copied by mistake.
const zips = readdirSync(artifactsDir)
  .filter((f) => f.endsWith(".zip"))
  .map((f) => ({ f, mtime: statSync(join(artifactsDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (zips.length === 0) {
  console.error("No .zip found in web-ext-artifacts/. Run `npm run build` first.");
  process.exit(1);
}

const zip = zips[0].f;
const xpi = zip.replace(/\.zip$/, ".xpi");
copyFileSync(join(artifactsDir, zip), join(artifactsDir, xpi));
console.log(`Created web-ext-artifacts/${xpi}`);
