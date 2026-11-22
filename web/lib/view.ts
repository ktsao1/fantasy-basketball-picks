// Derived views over the pipeline JSON. Pages stay declarative; the joins live here.

import type { Change, Data, Pickup, Player, Team, WeekGame } from "./types";
import { lastName, tip, unavailable } from "./format";

const SLOT_ORDER = ["PG", "SG", "SF", "PF", "C", "G", "F", "UT", "BE", "IR"];
export const slotType = (s: string) => s.replace(/\d+$/, "");
const BENCH = new Set(["BE", "IR"]);

export function gameOn(p: Player | undefined, date: string): WeekGame | undefined {
  if (!p) return undefined;
  if (p.week_games) return p.week_games.find((g) => g.date === date);
  // Snapshots from before engine 1.2 only have dates: keep the game, without opponent or time.
  return p.game_dates_left?.includes(date) ? { date, opponent: null, home: false, start_utc: null, started: false } : undefined;
}

/** "TOR @ DET · 7:30 PM", or null when he has no game that day. */
export function gameLine(p: Player, date: string): string | null {
  const g = gameOn(p, date);
  if (!g) return null;
  if (!g.opponent) return `${p.nba_team} · ${g.started ? "Locked" : "Game scheduled"}`;
  const vs = `${p.nba_team} ${g.home ? "vs" : "@"} ${g.opponent}`;
  return `${vs} · ${g.started ? "Locked" : tip(g.start_utc)}`;
}

/** "TOR @ DET · Final", for a game on a finished day. */
export function finalLine(p: Player, date: string): string {
  const g = gameOn(p, date);
  if (!g) return `${p.nba_team} · No game`;
  return g.opponent ? `${p.nba_team} ${g.home ? "vs" : "@"} ${g.opponent} · Final` : `${p.nba_team} · Final`;
}

/** Every day of this matchup week, finished days included, in order. */
export function weekDays(data: Data): string[] {
  return data.meta.matchup_days?.length ? data.meta.matchup_days : lineupDays(data);
}

/** Days with a recommended lineup, i.e. the rest of this matchup week, in order. */
export function lineupDays(data: Data): string[] {
  return [...new Set(data.recommendations.lineup.map((l) => l.date).filter(Boolean))] as string[];
}

export function changesFor(data: Data, date: string): Change[] {
  const r = data.recommendations;
  return r.changes_by_day?.[date] ?? (date === lineupDays(data)[0] ? r.changes : []);
}

/** Recommended projection per player on a day (null = locked, game started). */
function recValues(data: Data, date: string): Map<number, number | null> {
  const m = new Map<number, number | null>();
  for (const l of data.recommendations.lineup) if (l.date === date && l.player_id != null) m.set(l.player_id, l.projected_fpts ?? null);
  return m;
}

export type Move = { start: Player; slot: string; out: Player | null; value: number | null; lock: string | null };
export type LineupRow = {
  slot: string;
  player: Player;
  game: WeekGame | undefined;
  /** Projection for this day, or null when he can't play or his game is live. */
  value: number | null;
  /** Points already scored today (live or finished game), from ESPN. */
  scored: number | null;
  state: "play" | "live" | "idle" | "out";
  /** A recommended starter who takes this player's slot. */
  replacedBy?: Move;
  /** For a bench player: the slot he's recommended into. */
  startAt?: string;
};

export type DayView = {
  date: string;
  starters: LineupRow[];
  bench: LineupRow[];
  moves: Move[];
  /** Projected total with the recommended lineup. */
  withMoves: number;
  /** Projected total for the lineup exactly as set on ESPN. */
  asSet: number;
  playing: number;
  playingAsSet: number;
  liveCount: number;
  /** Points already scored by starters whose games have started. */
  liveScored: number;
  watch: Player[];
};

export function dayView(data: Data, players: Map<number, Player>, date: string): DayView {
  const rec = recValues(data, date);
  const moves: Move[] = [];
  for (const c of changesFor(data, date)) {
    const start = players.get(c.player_id);
    if (c.action !== "start" || !start) continue;
    const g = gameOn(start, date);
    moves.push({
      start, slot: c.to_slot ?? "", out: c.replaces != null ? players.get(c.replaces) ?? null : null,
      value: rec.get(start.id) ?? null, lock: g ? tip(g.start_utc) : null,
    });
  }
  const byOut = new Map(moves.filter((m) => m.out).map((m) => [m.out!.id, m]));
  const startSlot = new Map(moves.map((m) => [m.start.id, m.slot]));

  const roster = [...data.my_team.roster].sort(
    (a, b) => SLOT_ORDER.indexOf(slotType(a.lineup_slot ?? "BE")) - SLOT_ORDER.indexOf(slotType(b.lineup_slot ?? "BE")),
  );
  const rows: LineupRow[] = [];
  for (const r of roster) {
    const p = players.get(r.player_id);
    if (!p) continue;
    const game = gameOn(p, date);
    const out = unavailable(p);
    const live = !!game?.started && rec.has(p.id) && rec.get(p.id) == null;
    const value = out || !game ? null : live ? null : rec.has(p.id) ? rec.get(p.id)! : p.projection.engine_fpts_per_game ?? null;
    rows.push({
      slot: slotType(r.lineup_slot ?? "BE"), player: p, game, value, scored: live ? p.points_today ?? null : null,
      state: out ? "out" : !game ? "idle" : live ? "live" : "play",
      replacedBy: byOut.get(p.id), startAt: startSlot.get(p.id),
    });
  }
  const starters = rows.filter((r) => !BENCH.has(r.slot));
  const bench = rows.filter((r) => BENCH.has(r.slot));
  const sum = (xs: (number | null)[]) => xs.reduce<number>((s, v) => s + (v ?? 0), 0);
  const withMoves = sum([...rec.values()]);
  const asSet = sum(starters.map((r) => r.value));
  const benchPlays = bench.some((r) => r.state === "play" && !r.startAt);
  return {
    date, starters, bench, moves, withMoves, asSet,
    playing: rec.size,
    playingAsSet: starters.filter((r) => r.state === "play" || r.state === "live").length,
    liveCount: starters.filter((r) => r.state === "live").length,
    liveScored: sum(starters.filter((r) => r.state === "live").map((r) => r.scored)),
    watch: benchPlays ? [] : starters.filter((r) => r.state === "play" && r.player.injury_status === "DAY_TO_DAY" && !r.replacedBy).map((r) => r.player),
  };
}

export type PastRow = {
  /** Where he sat that day ("PG", "UT", "BE"…), or null when that day's lineup wasn't saved. */
  slot: string | null;
  player: Pick<Player, "id" | "name" | "nba_team">;
  played: boolean;
  scored: number | null;
  /** "TOR @ DET · Final", or "No game". */
  line: string;
};
export type PastDay = {
  date: string;
  /** Starters in slot order (or, without slots, everyone who played, best first). */
  starters: PastRow[];
  bench: PastRow[];
  /** Points that counted: the starters' (or the whole roster's, without slots). */
  total: number;
  played: number;
  /** ESPN's box scores for this day have been fetched. */
  hasResults: boolean;
  /** That day's lineup slots are known, so the total is the starters' only. */
  hasSlots: boolean;
};

type DayLineups = Record<string, Record<string, Record<string, { slot: string; name: string; nba_team: string }>>>;

/**
 * A finished day for one team, from ESPN's box scores: that day's lineup (players since dropped
 * included), what each scored, and the points that counted.
 */
export function pastDay(
  team: Team | null | undefined, players: Map<number, Player>, actuals: Record<string, Record<string, number>>,
  lineups: DayLineups, date: string,
): PastDay {
  const pts = actuals[date];
  const saved = team ? lineups[date]?.[String(team.team_id)] : undefined;
  const row = (id: number, slot: string | null, fallback?: { name: string; nba_team: string }): PastRow | null => {
    const p = players.get(id);
    if (!p && !fallback) return null;
    const scored = pts?.[String(id)] ?? null;
    // A player since dropped isn't in this pull, so his schedule is unknown: a score means he played.
    const played = scored !== null && (scored !== 0 || !!gameOn(p, date));
    return {
      slot, player: p ?? { id, ...fallback! }, played, scored: played ? scored : null,
      line: p ? finalLine(p, date) : `${fallback!.nba_team} · ${played ? "Final" : "No game"}`,
    };
  };

  if (saved) {
    const rows = Object.entries(saved)
      .map(([id, e]) => row(Number(id), slotType(e.slot), e))
      .filter((r): r is PastRow => !!r)
      .sort((x, y) => SLOT_ORDER.indexOf(x.slot!) - SLOT_ORDER.indexOf(y.slot!) || (y.scored ?? -1) - (x.scored ?? -1));
    const starters = rows.filter((r) => !BENCH.has(r.slot!));
    return {
      date, starters, bench: rows.filter((r) => BENCH.has(r.slot!)),
      total: starters.reduce((t, r) => t + (r.scored ?? 0), 0),
      played: starters.filter((r) => r.played).length, hasResults: !!pts, hasSlots: true,
    };
  }

  // No saved lineup for this day: today's roster, everyone who played, bench included.
  const rows = (team?.roster ?? [])
    .map((r) => row(r.player_id, null))
    .filter((r): r is PastRow => !!r)
    .sort((x, y) => Number(y.played) - Number(x.played) || (y.scored ?? -1) - (x.scored ?? -1));
  return {
    date, starters: rows, bench: [], total: rows.reduce((t, r) => t + (r.scored ?? 0), 0),
    played: rows.filter((r) => r.played).length, hasResults: !!pts, hasSlots: false,
  };
}

export type SideDay = { rows: { player: Player; slot: string; value: number | null; scored: number | null; started: boolean }[]; total: number; off: Player[]; available: boolean };

/** One side's starters on a day: mine from the recommended lineup, theirs from the opponent's. */
export function sideDay(data: Data, players: Map<number, Player>, date: string, mine: boolean, pickup?: Pickup, recommended = true): SideDay {
  const team = mine ? data.my_team : data.opponent;
  const available = mine || !!data.recommendations.opponent_lineup;
  const preview = mine ? pickup?.lineup_preview?.[date] : undefined;
  const original = mine ? data.recommendations.lineup : data.recommendations.opponent_lineup ?? [];
  const slots = preview ?? original.filter((s) => s.date === date);
  const projected = slots
    .filter((s) => s.player_id != null && players.has(s.player_id))
    .map((s) => {
      const player = players.get(s.player_id!)!;
      const live = s.projected_fpts == null && !!gameOn(player, date)?.started;
      return { player, slot: s.slot, value: s.projected_fpts ?? null, scored: live ? player.points_today ?? null : null, started: live };
    })
  const asSet = mine && !recommended && preview === undefined
    ? dayView(data, players, date).starters
      .filter((row) => row.state === "play" || row.state === "live")
      .map(({ player, slot, value, scored, state }) => ({ player, slot, value, scored, started: state === "live" }))
    : projected;
  const rows = asSet.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const on = new Set(rows.map((r) => r.player.id));
  const roster = (team?.roster ?? []).map((r) => r.player_id);
  const ids = preview && pickup ? [...roster.filter((id) => id !== pickup.drop_player_id), pickup.add_player_id] : roster;
  const off = ids.map((id) => players.get(id)).filter((p): p is Player => !!p && !on.has(p.id));
  return { rows, total: rows.reduce((s, r) => s + (r.value ?? 0) + (r.scored ?? 0), 0), off, available };
}

/** Weekly score through the selected date. Forecasts start from ESPN's current score. */
export function scoreThroughDate(
  data: Data, players: Map<number, Player>, actuals: Record<string, Record<string, number>>,
  lineups: DayLineups, date: string, preview?: ReadonlyMap<string, SideDay>,
) {
  const today = data.meta.today;
  const through = weekDays(data).filter((day) => day <= date);
  const current = [data.matchup.my_score, data.matchup.opponent_score] as const;
  const scores = [data.my_team, data.opponent].map((team, i) => {
    if (date === today) return current[i];
    if (date > today) {
      if (current[i] == null) return null;
      const remaining = through.filter((day) => day >= today).map((day) => (i === 0 ? preview?.get(day) : undefined) ?? sideDay(data, players, day, i === 0));
      if (remaining.some((side) => !side.available)) return null;
      return current[i] + remaining.reduce((total, side) =>
        total + side.rows.reduce((sum, row) => sum + (row.value ?? 0), 0), 0);
    }
    if (!team) return null;
    const finished = through.map((day) => pastDay(team, players, actuals, lineups, day));
    if (finished.some((day) => !day.hasResults || !day.hasSlots)) return null;
    return finished.reduce((total, day) => total + day.total, 0);
  });
  return { mine: scores[0], opponent: scores[1], through: through.length };
}

export function pickupFor(data: Data, addId: number): { pickup: Pickup; rank: number } | null {
  const i = data.recommendations.pickups.findIndex((p) => p.add_player_id === addId);
  return i < 0 ? null : { pickup: data.recommendations.pickups[i], rank: i };
}

/** Fantasy points per game from each scoring stat, using the league's point values. */
export function pointsBreakdown(data: Data, p: Player): { stat: string; per: number; points: number; value: number }[] {
  const line = p.stats.last_15?.gp ? p.stats.last_15 : p.stats.season;
  const items = data.meta.scoring_items ?? [];
  if (!line) return [];
  return items
    .map((it) => {
      const per = line.avg[it.stat] ?? 0;
      return { stat: it.stat, per, points: it.points, value: per * it.points };
    })
    .sort((a, b) => b.value - a.value);
}

export const STAT_NAMES: Record<string, string> = {
  PTS: "Points", REB: "Rebounds", AST: "Assists", STL: "Steals", BLK: "Blocks", "3PM": "3-pointers",
  FGM: "Field goals made", FGA: "Field goal attempts", FTM: "Free throws made", FTA: "Free throw attempts", TO: "Turnovers",
};

export const ESPN_TEAM_URL = "https://fantasy.espn.com/basketball/team?leagueId=1851873571&teamId=14&seasonId=2027";

/** When an add made now starts counting, phrased the same everywhere. */
export function addTiming(data: Data): string {
  const eff = data.meta.adds_effective_date;
  if (eff && eff > data.meta.today) {
    const [y, m, d] = eff.split("-").map(Number);
    return `Adds made now count from ${new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" })}`;
  }
  return "Adds lock at today’s first tip-off";
}

/** If the player you'd drop plays today, the advice for when to make the move. */
export function dropCaution(data: Data, drop: Player | undefined): string | null {
  const g = drop ? gameOn(drop, data.meta.today) : undefined;
  if (!drop || !g) return null;
  const name = lastName(drop.name);
  return g.started
    ? `${name}’s game has tipped off. If it’s still underway, wait until it ends to keep his points.`
    : `${name} plays today (${tip(g.start_utc)}). Wait until his game ends to keep his points.`;
}

// ---------- ranking ----------

/** Matchup weeks left in the regular season, this one included. */
export function weeksLeft(data: Data): number {
  return Math.max(1, (data.meta.regular_season_weeks ?? 19) - data.meta.matchup_period + 1);
}

/** The score the engine ranks pickups by: this week's gain plus a typical later week's. */
export function pickupValue(data: Data, pk: Pickup): number {
  return pk.value ?? Math.round((pk.gain_this_week + pk.gain_rest_of_season / weeksLeft(data)) * 10) / 10;
}

/** Rest-of-season gain spread over the weeks left: what one later week is worth. */
export function perWeekLater(data: Data, pk: Pickup): number {
  return pk.gain_rest_of_season / weeksLeft(data);
}

// ---------- what an add can use ----------

/** The first day an add made now counts: adds lock at the first tip, waiver claims take a day more. */
export function addStart(data: Data, p?: Player): string {
  const eff = data.meta.adds_effective_date ?? data.meta.today;
  if (p?.free_agent_status !== "WAIVERS") return eff;
  const [y, m, d] = eff.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/** His games this week that an add made now would count. */
export function countableGames(data: Data, p: Player): number {
  const from = addStart(data, p);
  return (p.game_dates_left ?? []).filter((d) => d >= from).length;
}

export function countableSchedule(data: Data, p: Player): WeekGame[] {
  return (p.game_dates_left ?? []).filter((date) => date >= addStart(data, p))
    .map((date) => gameOn(p, date)).filter((game): game is WeekGame => !!game);
}

/** His projected points from the games an add can use (the engine's week total, scaled). */
export function countableProjection(data: Data, p: Player): number | null {
  const week = p.projection.engine_week_fpts;
  if (week == null) return null;
  const all = p.game_dates_left?.length ?? p.games_left_this_week;
  return all ? (week * countableGames(data, p)) / all : 0;
}

// ---------- scenarios ----------

/** z for the engine's published 80% ranges (pipeline/engine/projection.py RANGE_Z). */
const RANGE_Z = 1.28;

function normalCdf(x: number): number {
  // Abramowitz–Stegun 7.1.26: plenty for a percentage shown to the nearest point.
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Final projection for the selected lineup settings. Actual points are already in the ESPN score. */
export function matchupProjection(data: Data, players: Map<number, Player>, preview: ReadonlyMap<string, SideDay>) {
  const projection = data.recommendations.matchup_projection ?? data.matchup.projected;
  if (projection?.mine == null || projection.opponent == null) return null;
  const adjustment = weekDays(data).filter((date) => date >= data.meta.today).reduce((total, date) => {
    const engine = sideDay(data, players, date, true);
    const selected = preview.get(date) ?? engine;
    const projectedPoints = (side: SideDay) => side.rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
    return total + projectedPoints(selected) - projectedPoints(engine);
  }, 0);
  const mine = projection.mine + adjustment;
  const spread = (range?: [number, number] | null) => range ? (range[1] - range[0]) / (2 * RANGE_Z) : 0;
  const sd = Math.hypot(spread(projection.mine_range), spread(projection.opponent_range));
  const margin = mine - projection.opponent;
  const win = Math.abs(adjustment) < 0.001
    ? projection.win_probability ?? null
    : sd > 0 ? normalCdf(margin / sd) : null;
  return { mine, opponent: projection.opponent, win };
}

/** "up 5", "down 30", "tied", from a margin in points. */
export function marginWord(x: number): string {
  const r = Math.round(x);
  return r === 0 ? "tied" : r > 0 ? `up ${r}` : `down ${-r}`;
}

/** Engine labels say "fpts"; the interface says "pts". */
export function pts(label: string): string {
  return label.replace(/\bfpts\b/g, "pts");
}
