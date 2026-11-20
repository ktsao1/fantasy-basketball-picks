// Copies the pipeline's JSON into public/data so the static site can fetch it.
// Runs before `dev` and `build`. Source is ../data, or DATA_DIR if set
// (handy for pointing the dashboard at a local sample while developing).
//
// Copies: latest.json, snapshots/featured.json, and only the snapshots that
// featured.json lists (not the whole history).

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(process.env.DATA_DIR ?? join(here, "..", "..", "data"));
const out = join(here, "..", "public", "data");

const latest = join(src, "latest.json");
if (!existsSync(latest)) {
  console.error(`copy-data: no latest.json in ${src}`);
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "snapshots"), { recursive: true });
copyFileSync(latest, join(out, "latest.json"));

const featuredPath = join(src, "snapshots", "featured.json");
let featured = [];
if (existsSync(featuredPath)) {
  featured = JSON.parse(readFileSync(featuredPath, "utf8"));
  if (!Array.isArray(featured)) throw new Error("featured.json must be an array");
}

const kept = [];
for (const entry of featured) {
  const file = join(src, "snapshots", entry.file);
  if (!entry.file || !entry.title || !existsSync(file)) {
    console.warn(`copy-data: skipping featured entry ${JSON.stringify(entry.file)} (missing file or title)`);
    continue;
  }
  copyFileSync(file, join(out, "snapshots", entry.file));
  kept.push({ file: entry.file, title: entry.title, description: entry.description ?? "" });
}
writeFileSync(join(out, "featured.json"), JSON.stringify(kept));

console.log(`copy-data: latest.json + ${kept.length} featured snapshot(s) from ${src}`);
