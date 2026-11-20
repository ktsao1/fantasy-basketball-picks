// POST /api/recommend → a validated RecommendationRun for the committed snapshot.
// The snapshot is read on the server (never sent by the browser), so the route
// can only ever analyse the data in this deploy.
import { recommend, RecommendError } from "@/lib/claude";
import { buildRun } from "@/lib/recommendations";
import { readRawSnapshot, toWorldState } from "@/lib/snapshot";

export const maxDuration = 300; // Opus with thinking can take a minute or two

// Crude per-instance brake on a public link: one live call at a time, 20s apart.
let inFlight = false;
let lastStarted = 0;

export async function POST() {
  const now = Date.now();
  // Fail fast (and don't start the brake) when the call could never reach Claude.
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { ok: false, code: "no_key", error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 503 },
    );
  }
  if (inFlight || now - lastStarted < 20_000) {
    return Response.json(
      { ok: false, code: "busy", error: "An analysis just ran. Wait a few seconds and try again." },
      { status: 429 },
    );
  }
  inFlight = true;
  lastStarted = now;

  try {
    const current = readRawSnapshot("snapshot.json");
    if (!current) throw new RecommendError("data/snapshot.json is missing.", 500, "no_snapshot");
    const previous = readRawSnapshot("previous.json");
    const world = toWorldState(current);

    const { raw, model, usage } = await recommend(current, previous);
    const { warnings, ...run } = buildRun(raw, world, "claude", new Date().toISOString());

    // Everything the model said was dropped as unlinkable: treat as a failure, not an empty screen.
    if (run.recommendations.length === 0) {
      throw new RecommendError(
        "Claude's answer didn't reference any player in the snapshot.",
        502,
        "unlinked",
      );
    }

    console.info(`[recommend] ${model} in ${Date.now() - now}ms, tokens in/out ${usage.input}/${usage.output}`);
    if (warnings.length) console.warn(`[recommend] dropped:\n${warnings.join("\n")}`);
    return Response.json({ ok: true, run, warnings, model, usage, ms: Date.now() - now });
  } catch (e) {
    const err =
      e instanceof RecommendError ? e : new RecommendError(`Unexpected error: ${(e as Error).message}`, 500, "unknown");
    console.error(`[recommend] ${err.code}: ${err.message}`);
    return Response.json({ ok: false, code: err.code, error: err.message }, { status: err.status });
  } finally {
    inFlight = false;
  }
}
