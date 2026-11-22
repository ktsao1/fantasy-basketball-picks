// Copies the pipeline's JSON into public/data so the static site can fetch it.
// Runs before `dev` and `build`. Source is ../data, or DATA_DIR if set
// (handy for pointing the dashboard at a local sample while developing).

import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
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
mkdirSync(out, { recursive: true });
copyFileSync(latest, join(out, "latest.json"));

// The graded record of past calls (pipeline/track_record.py); optional.
const record = join(src, "track_record.json");
if (existsSync(record)) copyFileSync(record, join(out, "track_record.json"));

// Finished days (pipeline/track_record.py), both optional: final points per player, and
// each team's lineup that day. Past days in the date stepper show these.
const extra = ["actuals.json", "lineups.json"].filter((f) => existsSync(join(src, f)));
for (const f of extra) copyFileSync(join(src, f), join(out, f));

console.log(`copy-data: latest.json${extra.map((f) => ` + ${f}`).join("")} from ${src}`);
