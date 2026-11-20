// Server-only: one Claude call that turns the snapshot into recommendations.
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { RawRecommendations, RawSnapshot } from "./ontology";

export const MODEL = "claude-opus-5-5";

/** The system prompt is the "## System prompt" section of recommend_prompt.md, verbatim. */
export function loadSystemPrompt(): string {
  const md = readFileSync(path.join(process.cwd(), "recommend_prompt.md"), "utf-8");
  const start = md.indexOf("## System prompt");
  const end = md.indexOf("## Notes for the build");
  if (start === -1) throw new Error("recommend_prompt.md has no '## System prompt' section");
  return md.slice(start + "## System prompt".length, end === -1 ? undefined : end).trim();
}

// The output contract from recommend_prompt.md, enforced by structured outputs.
// Counts (≤4 lines, ≤3 pickups, 2–3 factors) are checked afterwards in buildRun.
const Factor = z.object({
  label: z.string(),
  value: z.string(),
  direction: z.enum(["up", "down", "neutral"]),
});
const Confidence = z.enum(["high", "medium", "low"]);
export const RecommendationsSchema = z.object({
  briefing: z.array(z.string()),
  lineup: z.array(
    z.object({
      player_id: z.number().int(),
      action: z.enum(["START", "SIT", "MONITOR"]),
      reason: z.string(),
      factors: z.array(Factor),
      confidence: Confidence,
    }),
  ),
  pickups: z.array(
    z.object({
      add_player_id: z.number().int(),
      drop_player_id: z.number().int(),
      reason: z.string(),
      factors: z.array(Factor),
      confidence: Confidence,
    }),
  ),
});

/** The previous snapshot only needs what can "change": availability, schedule, recent form. */
function slimPrevious(prev: RawSnapshot) {
  return {
    generated_at: prev.generated_at,
    players: prev.players.map((p) => ({
      id: p.id,
      name: p.name,
      owner: p.owner,
      injury: p.injury,
      games_next_7: p.games_next_7.length,
      last_7: p.form.last_7,
    })),
  };
}

function strip({ _mock, ...rest }: RawSnapshot) {
  void _mock; // the model shouldn't reason about whether the data is a demo
  return rest;
}

export class RecommendError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export async function recommend(current: RawSnapshot, previous: RawSnapshot | null) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new RecommendError("ANTHROPIC_API_KEY is not set on the server.", 503, "no_key");
  }
  const client = new Anthropic({ timeout: 240_000, maxRetries: 1 });

  const payload = previous ? { previous: slimPrevious(previous), current: strip(current) } : strip(current);

  let message;
  try {
    message = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Opus 5.5 always thinks; effort is the depth control (its default is medium — set explicitly).
      output_config: { effort: "medium", format: betaZodOutputFormat(RecommendationsSchema) },
      // If a safety classifier declines, the API retries on a fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: loadSystemPrompt(),
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      throw new RecommendError("The Anthropic API key was rejected.", 502, "bad_key");
    if (e instanceof Anthropic.RateLimitError)
      throw new RecommendError("Anthropic rate limit hit. Try again in a minute.", 429, "rate_limited");
    if (e instanceof Anthropic.APIConnectionTimeoutError)
      throw new RecommendError("Claude took too long to answer.", 504, "timeout");
    if (e instanceof Anthropic.APIError)
      throw new RecommendError(`Claude API error ${e.status ?? ""}: ${e.message}`, 502, "api_error");
    // Structured output that fails the Zod schema lands here too.
    throw new RecommendError(`Claude's answer couldn't be read: ${(e as Error).message}`, 502, "bad_output");
  }

  if (message.stop_reason === "refusal")
    throw new RecommendError("Claude declined to answer this request.", 502, "refusal");
  if (message.stop_reason === "max_tokens")
    throw new RecommendError("Claude's answer was cut off before it finished.", 502, "truncated");
  if (!message.parsed_output)
    throw new RecommendError("Claude returned JSON that doesn't match the format.", 502, "bad_output");

  return {
    raw: message.parsed_output as RawRecommendations,
    model: message.model,
    usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
  };
}
