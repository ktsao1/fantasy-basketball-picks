// Turns the model's wire JSON into Recommendation objects linked to the WorldState.
// Anything that doesn't link to a real object (unknown id, drop not on my roster) is dropped
// and reported, so the UI never renders a card about a player who isn't there.
import type {
  Factor,
  LineupRecommendation,
  PickupRecommendation,
  RawRecommendations,
  RecommendationRun,
  WorldState,
} from "./ontology";

const LINEUP_ACTIONS = new Set(["START", "SIT", "MONITOR"]);
const CONFIDENCE = new Set(["high", "medium", "low"]);
const DIRECTIONS = new Set(["up", "down", "neutral"]);

function cleanFactors(factors: unknown): Factor[] {
  if (!Array.isArray(factors)) return [];
  return factors
    .filter(
      (f): f is Factor =>
        !!f && typeof f.label === "string" && f.value !== undefined && DIRECTIONS.has(f.direction),
    )
    .slice(0, 3)
    .map((f) => ({ label: f.label, value: String(f.value), direction: f.direction }));
}

export function buildRun(
  raw: RawRecommendations,
  world: WorldState,
  source: RecommendationRun["source"],
  generatedAt: string, // passed in: Next's prerender forbids new Date() inside components
): RecommendationRun & { warnings: string[] } {
  const at = world.league.snapshotAt;
  const warnings: string[] = [];
  const onRoster = new Set(world.roster);
  const isFreeAgent = new Set(world.freeAgents);

  const lineup: LineupRecommendation[] = [];
  const seen = new Set<number>();
  for (const r of raw.lineup ?? []) {
    if (!onRoster.has(r.player_id)) {
      warnings.push(`Lineup: player ${r.player_id} is not on your roster; skipped.`);
      continue;
    }
    if (seen.has(r.player_id) || !LINEUP_ACTIONS.has(r.action)) {
      warnings.push(`Lineup: duplicate entry or unknown action "${r.action}" for player ${r.player_id}; skipped.`);
      continue;
    }
    seen.add(r.player_id);
    lineup.push({
      kind: "lineup",
      id: `${at}:${r.action}:${r.player_id}`,
      action: r.action,
      playerId: r.player_id,
      reason: r.reason,
      factors: cleanFactors(r.factors),
      confidence: CONFIDENCE.has(r.confidence) ? r.confidence : "low",
      approval: "pending",
    });
  }

  const pickups: PickupRecommendation[] = [];
  for (const r of raw.pickups ?? []) {
    if (!isFreeAgent.has(r.add_player_id) || !onRoster.has(r.drop_player_id)) {
      warnings.push(`Pickup: add ${r.add_player_id} / drop ${r.drop_player_id} doesn't match the snapshot; skipped.`);
      continue;
    }
    pickups.push({
      kind: "pickup",
      id: `${at}:ADD_DROP:${r.add_player_id}-${r.drop_player_id}`,
      action: "ADD_DROP",
      addPlayerId: r.add_player_id,
      dropPlayerId: r.drop_player_id,
      reason: r.reason,
      factors: cleanFactors(r.factors),
      confidence: CONFIDENCE.has(r.confidence) ? r.confidence : "low",
      approval: "pending",
    });
    if (pickups.length === 3) break;
  }

  return {
    snapshotAt: at,
    generatedAt,
    source,
    briefing: (raw.briefing ?? []).filter((l) => typeof l === "string").slice(0, 4),
    recommendations: [...lineup, ...pickups],
    warnings,
  };
}
