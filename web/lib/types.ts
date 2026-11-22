// Mirrors pipeline/schema.json (the output contract). Fields the views don't
// read are left loose so small schema additions don't break the build.

export type ConfidenceLevel = "high" | "medium" | "low";
export type Confidence = { level: ConfidenceLevel; basis: string };

export type StatLine = {
  fpts_avg: number | null;
  fpts_total: number | null;
  gp: number | null;
  mpg: number | null;
  avg: Record<string, number | null>;
};

export type RosterEntry = { player_id: number; lineup_slot: string | null };

export type Team = {
  team_id: number;
  name: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  standing: number | null;
  roster: RosterEntry[];
};

export type TeamSummary = Omit<Team, "roster"> & { is_mine: boolean };

export type WeekGame = {
  date: string;
  opponent: string | null;
  home: boolean;
  /** Tip-off as an ISO instant, or null when ESPN lists the time as TBD. */
  start_utc: string | null;
  started: boolean;
};

export type PlayerGame = {
  id: string;
  date: string;
  opponent: string | null;
  opponentName: string | null;
  home: boolean;
  stats: Record<string, number>;
};

export type Player = {
  id: number;
  name: string;
  nba_team: string;
  primary_position?: string;
  positions: string[];
  injury_status: string | null;
  expected_return?: string | null;
  owner: number | null;
  free_agent_rank: number | null;
  free_agent_status?: "FREEAGENT" | "WAIVERS" | null;
  stats: { season?: StatLine; last_7?: StatLine; last_15?: StatLine; last_30?: StatLine };
  projection: { espn: StatLine | null; engine_fpts_per_game?: number | null; engine_week_fpts?: number | null };
  games_left_this_week: number;
  game_dates_left?: string[];
  /** This matchup week's games for his NBA team, played or not (pipeline ≥ engine 1.2). */
  week_games?: WeekGame[];
  /** Fantasy points so far today, once his game has tipped off (ESPN box score, pipeline ≥ 1.2). */
  points_today?: number | null;
  back_to_back_dates?: string[];
  game_today_locked?: boolean;
  games_left_season?: number;
};

/**
 * One structured reason behind a recommendation (engine ≥ 1.1). `impact_fpts` is the factor's
 * signed share of the payoff; supporting signals (form, minutes, usage) have none. Factors come
 * ranked: drivers by |impact|, then signals. Snapshots from engine 1.0 have no factors.
 */
export type FactorKey =
  | "per_game" | "schedule" | "availability" | "lineup_fit" | "projection"
  | "form" | "minutes" | "usage" | "back_to_back" | "injury" | "waivers" | "slot";

export type Factor = {
  key: FactorKey;
  label: string;
  value: number | null;
  compare: number | null;
  unit: "fpts" | "fpts/g" | "games" | "mpg" | "%" | null;
  impact_fpts: number | null;
};

/** [low, high]: an 80% range. */
export type Range = [number, number];

export type LineupSlot = {
  date?: string;
  slot: string;
  player_id: number | null;
  projected_fpts?: number | null;
  reason: string;
  confidence: Confidence;
  factors?: Factor[];
};

export type Change = {
  action: "start" | "bench" | "move";
  player_id: number;
  from_slot?: string | null;
  to_slot?: string | null;
  /** For a start: the player whose slot he takes (engine ≥ 1.2). */
  replaces?: number | null;
  reason: string;
  confidence: Confidence;
  factors?: Factor[];
};

export type Pickup = {
  add_player_id: number;
  drop_player_id: number | null;
  lineup_preview?: Record<string, Omit<OpponentSlot, "date">[]>;
  gain_this_week: number;
  gain_this_week_range?: Range;
  gain_rest_of_season: number;
  /** The ranking score: this week's gain + rest-of-season gain ÷ weeks left (engine ≥ 1.2, later runs). */
  value?: number;
  reason: string;
  confidence: Confidence;
  factors?: Factor[];
};

export type OpponentSlot = { date: string; slot: string; player_id: number | null; projected_fpts: number | null };

export type Projected = {
  mine: number | null;
  opponent: number | null;
  mine_range?: Range;
  opponent_range?: Range | null;
  /** Chance of winning the matchup, 0–1 (engine ≥ 1.1). */
  win_probability?: number | null;
} | null;

export type Data = {
  meta: {
    schema_version: number;
    updated_at: string;
    season: number;
    scoring_type: string;
    scoring_items?: { stat: string; points: number }[];
    roster_slots: Record<string, number>;
    lineup_lock: string | null;
    matchup_period: number;
    matchup_days: string[];
    today: string;
    anonymized: boolean;
    free_agent_count: number;
    adds_effective_date?: string;
    regular_season_weeks?: number;
  };
  teams: TeamSummary[];
  my_team: Team;
  opponent: Team | null;
  matchup: {
    matchup_period: number;
    is_bye: boolean;
    my_score: number | null;
    opponent_score: number | null;
    projected?: Projected;
  };
  players: Player[];
  recommendations: {
    engine_version: string;
    lineup: LineupSlot[];
    changes: Change[];
    /** Changes vs. the lineup set on ESPN for each remaining day (engine ≥ 1.2). */
    changes_by_day?: Record<string, Change[]>;
    /** The opponent's best lineup for each remaining day (engine ≥ 1.2). */
    opponent_lineup?: OpponentSlot[];
    pickups: Pickup[];
    matchup_projection?: Projected;
  };
};

/** data/track_record.json (pipeline/track_record.py): past start calls graded against ESPN. */
export type Call = {
  date: string;
  player_id: number;
  name: string;
  nba_team: string;
  slot: string;
  projected: number;
  range: Range;
  made_at: string;
  tip_utc: string | null;
  actual: number | null;
  status?: "graded" | "pending" | "no_score";
};

export type WeekRecord = {
  matchup_period: number;
  opponent: string | null;
  points: { at: string; score_mine: number | null; score_opponent: number | null; projected_mine: number | null; projected_opponent: number | null; win_probability: number | null }[];
  final: { mine: number | null; opponent: number | null } | null;
};

export type TrackRecord = {
  updated_at: string;
  snapshots: number;
  first_snapshot: string | null;
  summary: {
    graded: number;
    pending: number;
    no_score?: number;
    days_graded: string[];
    mean_abs_error: number | null;
    bias: number | null;
    within_range: number;
    projected_total: number;
    actual_total: number;
  };
  calls: Call[];
  weeks: WeekRecord[];
};
