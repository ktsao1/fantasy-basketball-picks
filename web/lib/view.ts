// Derived views over the pipeline JSON. Pages stay declarative; the joins live here.

import type { Change, Data, Pickup, Player, WeekGame } from "./types";
import { tip, unavailable } from "./format";

const SLOT_ORDER = ["PG", "SG", "SF", "PF", "C", "G", "F", "UT", "BE", "IR"];
export const slotType = (s: string) => s.replace(/\d+$/, "");
const BENCH = new Set(["BE", "IR"]);

export function gameOn(p: Player | undefined, date: string): WeekGame | undefined {
  return p?.week_games?.find((g) => g.date === date);
}

/** "TOR @ DET · 7:30 PM", or null when he has no game that day. */
export function gameLine(p: Player, date: string): string | null {
  const g = gameOn(p, date);
  if (!g) return null;
  const vs = `${p.nba_team} ${g.home ? "vs" : "@"} ${g.opponent ?? "TBD"}`;
  return `${vs} · ${g.started ? "In progress" : tip(g.start_utc)}`;
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
      slot: slotType(r.lineup_slot ?? "BE"), player: p, game, value,
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
    watch: benchPlays ? [] : starters.filter((r) => r.state === "play" && r.player.injury_status === "DAY_TO_DAY" && !r.replacedBy).map((r) => r.player),
  };
}

export type SideDay = { rows: { player: Player; value: number | null }[]; total: number; off: Player[] };

/** One side's starters on a day: mine from the recommended lineup, theirs from the opponent's. */
export function sideDay(data: Data, players: Map<number, Player>, date: string, mine: boolean): SideDay {
  const team = mine ? data.my_team : data.opponent;
  const slots = mine ? data.recommendations.lineup : data.recommendations.opponent_lineup ?? [];
  const rows = slots
    .filter((s) => s.date === date && s.player_id != null && players.has(s.player_id))
    .map((s) => ({ player: players.get(s.player_id!)!, value: s.projected_fpts ?? null }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const on = new Set(rows.map((r) => r.player.id));
  const off = (team?.roster ?? []).map((r) => players.get(r.player_id)).filter((p): p is Player => !!p && !on.has(p.id));
  return { rows, total: rows.reduce((s, r) => s + (r.value ?? 0), 0), off };
}

/** Starters with a game, per remaining day, for both sides. */
export function gamesByDay(data: Data): { date: string; mine: number; theirs: number }[] {
  const days = lineupDays(data);
  const count = (xs: { date?: string; player_id: number | null }[], d: string) => xs.filter((x) => x.date === d && x.player_id != null).length;
  return days.map((d) => ({
    date: d,
    mine: count(data.recommendations.lineup, d),
    theirs: count(data.recommendations.opponent_lineup ?? [], d),
  }));
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
