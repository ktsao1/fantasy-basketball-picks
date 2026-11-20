// War Room ontology: every object the app reasons about, in one place.
// Layer 1 = raw wire shapes (what fetch_league.py writes and Claude returns).
// Layer 2 = ontology objects the UI uses (normalized, linked by id).

/* ───────── Layer 1: wire shapes ───────── */

export interface RawStatBlock {
  fpts_avg: number | null;
  cats: Record<string, number> | null; // e.g. { PTS: 24.1, REB: 6.2, "FG%": 0.48, ... }
}

export interface RawPlayer {
  id: number;
  name: string;
  position: string;
  eligible: string[];
  pro_team: string; // abbrev, e.g. "BOS"
  owner: "me" | "free_agent";
  lineup_slot: string | null; // "PG", "BE", "IR", ...
  injury: { status: string; expected_return: string | null };
  games_next_7: string[]; // ["Wed 11/18", ...]
  form: Record<FormWindow, RawStatBlock>;
}

export interface RawSnapshot {
  generated_at: string;
  league: { name: string; scoring_type: string; teams: number; matchup_period: number };
  my_team: { name: string; record: string };
  players: RawPlayer[];
  /** Set only on hand-made mock data; fetch_league.py never writes it. */
  _mock?: boolean;
}

/** Exactly the JSON format in recommend_prompt.md */
export interface RawRecommendations {
  briefing: string[];
  lineup: {
    player_id: number;
    action: LineupAction;
    reason: string;
    factors: Factor[];
    confidence: Confidence;
  }[];
  pickups: {
    add_player_id: number;
    drop_player_id: number;
    reason: string;
    factors: Factor[];
    confidence: Confidence;
  }[];
}

/* ───────── Layer 2: ontology objects ───────── */

export type FormWindow = "season" | "last_7" | "last_15" | "last_30" | "projected";
export const FORM_WINDOWS: FormWindow[] = ["season", "last_7", "last_15", "last_30", "projected"];

export type ScoringMode = "points" | "categories"; // from H2H_POINTS / H2H_CATEGORY / ROTO
export type InjuryStatus =
  | "ACTIVE"
  | "DAY_TO_DAY"
  | "OUT"
  | "INJURY_RESERVE"
  | "SUSPENSION"
  | "UNKNOWN";

export interface Injury {
  status: InjuryStatus;
  expectedReturn: string | null;
  isAvailable: boolean; // derived: ACTIVE or DAY_TO_DAY
}

export interface ProTeam {
  abbrev: string;
  gamesNext7: string[];
}

export interface StatLine {
  fptsAvg: number | null;
  cats: Record<string, number> | null;
}

export interface Player {
  id: number;
  name: string;
  position: string;
  eligible: string[];
  proTeam: string; // → ProTeam.abbrev
  owner: "me" | "free_agent";
  lineupSlot: string | null;
  injury: Injury;
  form: Record<FormWindow, StatLine>;
}

export interface League {
  name: string;
  scoring: ScoringMode;
  scoringRaw: string;
  teams: number;
  matchupPeriod: number;
  myTeam: { name: string; record: string };
  snapshotAt: string;
  isMock: boolean;
}

/** The whole snapshot after normalization: objects and their links */
export interface WorldState {
  league: League;
  players: Record<number, Player>;
  proTeams: Record<string, ProTeam>;
  roster: number[]; // Player ids, owner = me
  freeAgents: number[];
}

/* ───────── Recommendations ───────── */

export type LineupAction = "START" | "SIT" | "MONITOR";
export type RecommendationAction = LineupAction | "ADD_DROP";
export type Confidence = "high" | "medium" | "low";
export type Direction = "up" | "down" | "neutral";
export type ApprovalState = "pending" | "approved" | "dismissed";

export interface Factor {
  label: string; // "Games this week"
  value: string; // "4"
  direction: Direction;
}

interface RecommendationBase {
  id: string; // stable: `${snapshotAt}:${action}:${playerIds}`
  reason: string;
  factors: Factor[]; // 2–3 chips
  confidence: Confidence;
  approval: ApprovalState; // hydrated from localStorage, never from the model
}

export interface LineupRecommendation extends RecommendationBase {
  kind: "lineup";
  action: LineupAction;
  playerId: number;
}

export interface PickupRecommendation extends RecommendationBase {
  kind: "pickup";
  action: "ADD_DROP";
  addPlayerId: number;
  dropPlayerId: number;
}

export type Recommendation = LineupRecommendation | PickupRecommendation;

export interface RecommendationRun {
  snapshotAt: string;
  generatedAt: string;
  source: "claude" | "mock" | "cached"; // "cached" = last good result after a failed call
  briefing: string[];
  recommendations: Recommendation[];
  error?: string;
}
