"""The only module that talks to ESPN.

Everything that reads ESPN goes through here, so if ESPN's unofficial API changes
(or another platform is added later) there is one place to fix. Read-only: this
module never writes to ESPN.

Cookies come from .env at the repo root (ESPN_S2, SWID). They are never logged.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from espn_api.basketball import League
from espn_api.basketball.constant import POSITION_MAP, STATS_MAP
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
