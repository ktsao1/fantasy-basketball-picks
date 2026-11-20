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
  back_to_back_dates?: string[];
  game_today_locked?: boolean;
  games_left_season?: number;
};

export type LineupSlot = {
  date?: string;
  slot: string;
  player_id: number | null;
  projected_fpts?: number | null;
  reason: string;
  confidence: Confidence;
};

export type Change = {
  action: "start" | "bench" | "move";
  player_id: number;
  from_slot?: string | null;
  to_slot?: string | null;
  reason: string;
  confidence: Confidence;
};

export type Pickup = {
  add_player_id: number;
  drop_player_id: number | null;
  gain_this_week: number;
  gain_rest_of_season: number;
  reason: string;
  confidence: Confidence;
};

export type Projected = { mine: number | null; opponent: number | null } | null;

export type Data = {
  meta: {
    schema_version: number;
    updated_at: string;
    season: number;
    scoring_type: string;
    roster_slots: Record<string, number>;
    lineup_lock: string | null;
    matchup_period: number;
    matchup_days: string[];
    today: string;
    anonymized: boolean;
    free_agent_count: number;
    adds_effective_date?: string;
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
    pickups: Pickup[];
    matchup_projection?: Projected;
  };
};

export type FeaturedEntry = { file: string; title: string; description: string };
