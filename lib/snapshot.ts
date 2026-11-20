// The only place wire shapes become ontology objects. Server-only (uses fs).
// Read with readFileSync so Next prerenders it: the snapshot is baked into each deploy.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  FORM_WINDOWS,
  type FormWindow,
  type Injury,
  type InjuryStatus,
  type League,
  type Player,
  type ProTeam,
  type RawPlayer,
  type RawSnapshot,
  type ScoringMode,
  type StatLine,
  type WorldState,
} from "./ontology";

const DATA_DIR = path.join(process.cwd(), "data");

export function readRawSnapshot(file: "snapshot.json" | "previous.json"): RawSnapshot | null {
  const p = path.join(DATA_DIR, file);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as RawSnapshot;
}

const KNOWN_INJURY: InjuryStatus[] = [
  "ACTIVE",
  "DAY_TO_DAY",
  "OUT",
  "INJURY_RESERVE",
  "SUSPENSION",
];

function toInjury(raw: RawPlayer["injury"]): Injury {
  // espn_api sometimes reports a healthy player as "NORMAL" or empty.
  const s = (raw.status || "ACTIVE").toUpperCase();
  const status: InjuryStatus =
    s === "NORMAL" ? "ACTIVE" : KNOWN_INJURY.includes(s as InjuryStatus) ? (s as InjuryStatus) : "UNKNOWN";
  return {
    status,
    expectedReturn: raw.expected_return,
    isAvailable: status === "ACTIVE" || status === "DAY_TO_DAY",
  };
}

export function toScoringMode(scoringType: string): ScoringMode {
  return scoringType.toUpperCase().includes("POINTS") ? "points" : "categories";
}

function toPlayer(raw: RawPlayer): Player {
  const form = {} as Record<FormWindow, StatLine>;
  for (const w of FORM_WINDOWS) {
    const b = raw.form?.[w];
    form[w] = { fptsAvg: b?.fpts_avg ?? null, cats: b?.cats ?? null };
  }
  return {
    id: raw.id,
    name: raw.name,
    position: raw.position,
    eligible: raw.eligible,
    proTeam: raw.pro_team,
    owner: raw.owner,
    lineupSlot: raw.lineup_slot,
    injury: toInjury(raw.injury),
    form,
  };
}

export function toWorldState(raw: RawSnapshot): WorldState {
  const players: Record<number, Player> = {};
  const proTeams: Record<string, ProTeam> = {};
  const roster: number[] = [];
  const freeAgents: number[] = [];

  for (const rp of raw.players) {
    const p = toPlayer(rp);
    players[p.id] = p;
    (p.owner === "me" ? roster : freeAgents).push(p.id);
    // Schedule lives on the team, once; players link to it by abbrev.
    proTeams[p.proTeam] ??= { abbrev: p.proTeam, gamesNext7: rp.games_next_7 };
  }

  const league: League = {
    name: raw.league.name,
    scoring: toScoringMode(raw.league.scoring_type),
    scoringRaw: raw.league.scoring_type,
    teams: raw.league.teams,
    matchupPeriod: raw.league.matchup_period,
    myTeam: raw.my_team,
    snapshotAt: raw.generated_at,
    isMock: raw._mock === true,
  };

  return { league, players, proTeams, roster, freeAgents };
}

export function loadWorld(): WorldState {
  const raw = readRawSnapshot("snapshot.json");
  if (!raw) throw new Error("data/snapshot.json is missing. Run `python fetch_league.py`.");
  return toWorldState(raw);
}
