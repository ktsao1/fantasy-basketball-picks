"""The only module that talks to ESPN.

Everything that reads ESPN goes through here, so if ESPN's unofficial API changes
(or another platform is added later) there is one place to fix. Read-only: this
module never writes to ESPN.

Cookies come from .env at the repo root (ESPN_S2, SWID). They are never logged.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from espn_api.basketball import League
from espn_api.basketball.constant import POSITION_MAP, PRO_TEAM_MAP, STATS_MAP
from espn_api.requests.espn_requests import (
    ESPNAccessDenied,
    ESPNInvalidLeague,
    ESPNUnknownError,
)

PLAYER_POSITIONS = {1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C"}

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")


class ReconnectNeeded(Exception):
    """ESPN rejected the cookies (missing or expired). Kevin needs to copy fresh ones."""

    MESSAGE = (
        "ESPN rejected the login cookies. Reconnect: open fantasy.espn.com in Chrome "
        "(signed in), copy espn_s2 and SWID from DevTools → Application → Cookies, "
        "and paste them into .env."
    )

    def __init__(self, detail: str = ""):
        super().__init__(self.MESSAGE + (f" ({detail})" if detail else ""))


@dataclass(frozen=True)
class Config:
    league_id: int
    team_id: int
    season: int
    espn_s2: str
    swid: str


def load_config() -> Config:
    s2 = os.environ.get("ESPN_S2", "").strip()
    swid = os.environ.get("SWID", "").strip()
    if not s2 or not swid:
        raise ReconnectNeeded("ESPN_S2 or SWID is empty in .env")
    if not (swid.startswith("{") and swid.endswith("}")):
        raise ReconnectNeeded("SWID must keep its curly braces")
    return Config(
        league_id=int(os.environ.get("ESPN_LEAGUE_ID", "1851873571")),
        team_id=int(os.environ.get("ESPN_TEAM_ID", "14")),
        season=int(os.environ.get("ESPN_SEASON", "2027")),
        espn_s2=s2,
        swid=swid,
    )


def connect(config: Config | None = None) -> League:
    config = config or load_config()
    try:
        return League(
            league_id=config.league_id,
            year=config.season,
            espn_s2=config.espn_s2,
            swid=config.swid,
        )
    except ESPNAccessDenied as e:
        raise ReconnectNeeded(str(e)) from None
    except ESPNInvalidLeague as e:
        raise RuntimeError(f"League not found: {e}") from None
    except ESPNUnknownError as e:
        raise RuntimeError(f"ESPN error: {e}") from None


def raw_settings(league: League) -> dict[str, Any]:
    """The mSettings view, for what the library doesn't expose (scoring items, roster slots, lock)."""
    try:
        data = league.espn_request.league_get(params={"view": "mSettings"})
    except ESPNAccessDenied as e:
        raise ReconnectNeeded(str(e)) from None
    return data["settings"]


def summarize_settings(league: League) -> dict[str, Any]:
    """Phase 0's open questions, answered from ESPN's settings."""
    s = raw_settings(league)
    scoring = s.get("scoringSettings", {})
    roster = s.get("rosterSettings", {})
    acq = s.get("acquisitionSettings", {})
    sched = s.get("scheduleSettings", {})

    items = []
    for item in scoring.get("scoringItems", []):
        stat_id = str(item.get("statId"))
        items.append(
            {
                "stat": STATS_MAP.get(stat_id, f"stat {stat_id}"),
                "points": item.get("points"),
                "lower_is_better": item.get("isReverseItem", False),
            }
        )

    slots = {
        POSITION_MAP.get(int(k), f"slot {k}"): n
        for k, n in roster.get("lineupSlotCounts", {}).items()
        if n
    }

    return {
        "name": s.get("name"),
        "teams": s.get("size"),
        "scoring_type": scoring.get("scoringType"),
        "scoring_items": items,
        "roster_slots": slots,
        "lineup_lock": roster.get("lineupLocktimeType"),
        "move_limit": roster.get("moveLimit"),
        # Keyed by player position id (1=PG … 5=C), not lineup slot. -1 means no limit.
        "position_limits": {
            PLAYER_POSITIONS.get(int(k), f"pos {k}"): v
            for k, v in roster.get("positionLimits", {}).items()
            if int(k) in PLAYER_POSITIONS and v != -1
        },
        "matchup_periods": sched.get("matchupPeriodCount"),
        "matchup_period_length": sched.get("matchupPeriodLength"),
        "playoff_teams": sched.get("playoffTeamCount"),
        "acquisition_limit": acq.get("acquisitionLimit"),
        "matchup_acquisition_limit": acq.get("matchupAcquisitionLimit"),
        "matchup_limit_per_scoring_period": acq.get("matchupLimitPerScoringPeriod"),
        "faab": acq.get("isUsingAcquisitionBudget"),
        "faab_budget": acq.get("acquisitionBudget"),
        "waiver_hours": acq.get("waiverHours"),
        "waiver_process_days": acq.get("waiverProcessDays"),
        "waiver_order_reset": acq.get("waiverOrderReset"),
        "trade_deadline": s.get("tradeSettings", {}).get("deadlineDate"),
        "_raw": {"roster": roster, "acquisition": acq},
    }


def my_team(league: League, team_id: int):
    for t in league.teams:
        if t.team_id == team_id:
            return t
    raise RuntimeError(f"Team {team_id} isn't in this league")


def current_matchup(league: League, team_id: int):
    """This matchup period's box score that includes Kevin's team, or None (e.g. preseason)."""
    try:
        boxes = league.box_scores()
    except ESPNAccessDenied as e:
        raise ReconnectNeeded(str(e)) from None
    for b in boxes:
        ids = {getattr(b.home_team, "team_id", b.home_team), getattr(b.away_team, "team_id", b.away_team)}
        if team_id in ids:
            return b
    return None


def free_agents(league: League, size: int = 25, position: str | None = None):
    try:
        return league.free_agents(size=size, position=position)
    except ESPNAccessDenied as e:
        raise ReconnectNeeded(str(e)) from None


def free_agents_with_status(league: League, size: int) -> list[tuple[Any, str]]:
    """Top free agents by % owned, each with ESPN's status: FREEAGENT (add now) or WAIVERS (claim, 24h)."""
    from espn_api.basketball.player import Player

    filters = {
        "players": {
            "filterStatus": {"value": ["FREEAGENT", "WAIVERS"]},
            "limit": size,
            "sortPercOwned": {"sortPriority": 1, "sortAsc": False},
            "sortDraftRanks": {"sortPriority": 100, "sortAsc": True, "value": "STANDARD"},
        }
    }
    try:
        data = league.espn_request.league_get(
            params={"view": "kona_player_info", "scoringPeriodId": league.scoringPeriodId},
            headers={"x-fantasy-filter": json.dumps(filters)},
        )
    except ESPNAccessDenied as e:
        raise ReconnectNeeded(str(e)) from None
    return [(Player(raw, league.year), raw.get("status") or "FREEAGENT") for raw in data.get("players", [])]


# ---------------------------------------------------------------------------
# Snapshot: everything Phase 1 stores, as plain dicts (no espn_api objects leak out,
# so the storage layer doesn't depend on this library or on ESPN).
# ---------------------------------------------------------------------------

ET = ZoneInfo("America/New_York")  # NBA game days are Eastern
STAT_SPLITS = ("total", "last_7", "last_15", "last_30", "projected")
FREE_AGENT_POOL = 150


def _player_row(p) -> dict[str, Any]:
    return {
        "player_id": p.playerId,
        "name": p.name,
        "pro_team": p.proTeam,
        "position": p.position,
        "eligible_slots": [s for s in p.eligibleSlots if s and s not in ("BE", "IR", "Rookie")],
        "injury_status": p.injuryStatus,
        "injured": bool(getattr(p, "injured", False)),
        "expected_return": p.expected_return_date.isoformat() if p.expected_return_date else None,
        "pos_rank": p.posRank,
    }


def _stat_rows(p, season: int) -> list[dict[str, Any]]:
    rows = []
    for split in STAT_SPLITS:
        s = p.stats.get(f"{season}_{split}")
        if not s:
            continue
        avg = s.get("avg") or {}
        total = s.get("total") or {}
        rows.append(
            {
                "player_id": p.playerId,
                "split": split,
                "fpts_total": s.get("applied_total"),
                "fpts_avg": s.get("applied_avg"),
                "gp": total.get("GP") or avg.get("GP"),
                "mpg": avg.get("MPG"),
                "avg": avg,
                "total": total,
            }
        )
    return rows


def _pro_games(league: League) -> list[dict[str, Any]]:
    games: dict[int, dict[str, Any]] = {}
    for team_games in league.pro_schedule.values():
        for period, gs in team_games.items():
            for g in gs:
                start = datetime.fromtimestamp(g["date"] / 1000, tz=timezone.utc)
                games[g["id"]] = {
                    "game_id": g["id"],
                    "scoring_period": int(period),
                    "game_date": start.astimezone(ET).date().isoformat(),
                    "start_utc": start.isoformat(),
                    "home_team": PRO_TEAM_MAP.get(g["homeProTeamId"]),
                    "away_team": PRO_TEAM_MAP.get(g["awayProTeamId"]),
                    "time_tbd": bool(g.get("startTimeTBD")),
                }
    return sorted(games.values(), key=lambda g: g["start_utc"])


def _matchup_periods(league: League, games: list[dict[str, Any]]) -> dict[int, list[int]]:
    """Matchup period → scoring periods (days).

    ESPN only reports days that have started, so the current week is extended to its
    Sunday (matchups run Monday–Sunday). An All-Star-length week isn't predictable from
    the settings; it shows up correctly once its days have started.
    """
    day_of = {}
    for g in games:
        day_of.setdefault(g["scoring_period"], g["game_date"])
    out = {int(m): sorted(int(sp) for sp in sps) for m, sps in league.matchup_ids.items()}
    cur = league.currentMatchupPeriod
    if cur in out and out[cur]:
        last = out[cur][-1]
        last_day = datetime.fromisoformat(day_of.get(last, datetime.now(ET).date().isoformat())).date()
        while last_day.weekday() != 6:  # Sunday
            last += 1
            last_day += timedelta(days=1)
            out[cur].append(last)
    return out


def _matchups(league: League) -> list[dict[str, Any]]:
    """Every scheduled matchup, keyed by ESPN's matchupPeriodId.

    Read raw because the library's per-team schedule skips bye weeks (9 teams, so one
    team sits out each week), which shifts its week numbering. A bye has no away team.
    """
    try:
        data = league.espn_request.league_get(params={"view": "mMatchupScore"})
    except ESPNAccessDenied as e:
        raise ReconnectNeeded(str(e)) from None
    rows = []
    for m in data.get("schedule", []):
        home, away = m.get("home", {}), m.get("away") or {}
        rows.append(
            {
                "matchup_period": m["matchupPeriodId"],
                "home_team_id": home.get("teamId"),
                "away_team_id": away.get("teamId"),
                "home_score": home.get("totalPointsLive", home.get("totalPoints")),
                "away_score": away.get("totalPointsLive", away.get("totalPoints")) if away else None,
                "winner": m.get("winner"),
                "playoff_tier": m.get("playoffTierType"),
            }
        )
    return rows


def _points_today(league: League) -> dict[int, float]:
    """Each rostered player's fantasy points so far today, from ESPN's box scores.

    Read-only and best effort: a failure here leaves the dashboard without live points,
    not without data.
    """
    try:
        boxes = league.box_scores(matchup_period=league.currentMatchupPeriod,
                                  scoring_period=league.scoringPeriodId, matchup_total=False)
    except Exception:  # noqa: BLE001 - live points are optional
        return {}
    out: dict[int, float] = {}
    for b in boxes:
        for lineup in (b.home_lineup or [], b.away_lineup or []):
            for pl in lineup:
                if pl.points is not None:
                    out[pl.playerId] = float(pl.points)
    return out


def fetch_snapshot(config: Config | None = None, free_agent_pool: int = FREE_AGENT_POOL) -> dict[str, Any]:
    """One read of everything: settings, teams, rosters, matchups, free agents, players, NBA schedule."""
    config = config or load_config()
    league = connect(config)
    season = config.season
    settings = summarize_settings(league)
    settings.pop("_raw", None)

    teams, rosters = [], []
    players: dict[int, dict[str, Any]] = {}
    stats: dict[tuple[int, str], dict[str, Any]] = {}

    for t in league.teams:
        teams.append(
            {
                "team_id": t.team_id,
                "name": t.team_name,
                "abbrev": t.team_abbrev,
                "wins": t.wins,
                "losses": t.losses,
                "ties": t.ties,
                "points_for": t.points_for,
                "points_against": t.points_against,
                "standing": t.standing,
                "acquisitions": t.acquisitions,
                "is_mine": t.team_id == config.team_id,
            }
        )
        for p in t.roster:
            rosters.append(
                {
                    "team_id": t.team_id,
                    "player_id": p.playerId,
                    "lineup_slot": p.lineupSlot or None,
                    "acquisition_type": p.acquisitionType,
                }
            )
            players[p.playerId] = _player_row(p)
            for r in _stat_rows(p, season):
                stats[(r["player_id"], r["split"])] = r

    free_agent_rows = []
    for rank, (p, status) in enumerate(free_agents_with_status(league, free_agent_pool), start=1):
        free_agent_rows.append({"player_id": p.playerId, "rank": rank, "status": status})
        players.setdefault(p.playerId, _player_row(p))
        for r in _stat_rows(p, season):
            stats.setdefault((r["player_id"], r["split"]), r)

    games = _pro_games(league)
    return {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "season": season,
        "my_team_id": config.team_id,
        "current_matchup_period": league.currentMatchupPeriod,
        "scoring_period": league.scoringPeriodId,
        "settings": settings,
        "teams": teams,
        "rosters": rosters,
        "matchups": _matchups(league),
        "free_agents": free_agent_rows,
        "players": list(players.values()),
        "player_stats": list(stats.values()),
        "pro_games": games,
        "matchup_periods": _matchup_periods(league, games),
        "points_today": _points_today(league),
    }
