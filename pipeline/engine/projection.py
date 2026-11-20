"""Per-game fantasy-point projections and availability.

Projection per game = a blend of ESPN's projection, the season average and the last 15
days, nudged by the minutes trend and by injured high-usage teammates. Expected points
for a given game also multiply by availability (injury status) and a small back-to-back
discount.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Blend weights before sample-size adjustment.
W_ESPN, W_SEASON, W_RECENT = 0.35, 0.35, 0.30
MIN_RECENT_GP = 3          # fewer recent games → ignore the last-15 split
FULL_SEASON_GP = 8         # season average gets full weight from this many games
MINUTES_SENSITIVITY = 0.5  # +10% minutes → +5% projection
MINUTES_CLAMP = (0.85, 1.15)
TEAMMATE_OUT_BUMP = 0.04   # per injured high-usage teammate
TEAMMATE_OUT_CAP = 0.08
HIGH_USAGE_FPTS = 30.0
BACK_TO_BACK = 0.95

# Chance he plays a given game this week, by ESPN status.
AVAILABILITY = {"ACTIVE": 1.0, None: 1.0, "PROBABLE": 0.9, "DAY_TO_DAY": 0.65,
                "QUESTIONABLE": 0.55, "DOUBTFUL": 0.2, "OUT": 0.0,
                "INJURY_RESERVE": 0.0, "SUSPENSION": 0.0}
# Share of the rest of the season he's expected to play. ESPN gives no return dates here,
# so OUT is an informed guess, and confidence says so.
SEASON_AVAILABILITY = {"ACTIVE": 1.0, None: 1.0, "PROBABLE": 1.0, "DAY_TO_DAY": 0.95,
                       "QUESTIONABLE": 0.95, "DOUBTFUL": 0.85, "OUT": 0.6,
                       "INJURY_RESERVE": 0.4, "SUSPENSION": 0.8}


@dataclass
class Projection:
    player_id: int
    per_game: float                 # fpts per game if he plays
    season_gp: int
    recent_gp: int
    season_avg: float | None
    recent_avg: float | None
    espn: float | None
    minutes_factor: float = 1.0
    teammates_out: list[str] = field(default_factory=list)


def _fpts(p: dict, split: str) -> tuple[float | None, int]:
    s = p["stats"].get(split)
    if not s or s.get("fpts_avg") is None:
        return None, 0
    return float(s["fpts_avg"]), int(s.get("gp") or 0)


def project_all(players: list[dict[str, Any]]) -> dict[int, Projection]:
    # High-usage players currently out, by NBA team, for the teammate bump.
    out_by_team: dict[str, list[str]] = {}
    for p in players:
        avg, gp = _fpts(p, "season")
        if p["injury_status"] in ("OUT", "INJURY_RESERVE") and avg and avg >= HIGH_USAGE_FPTS and gp >= 5:
            out_by_team.setdefault(p["nba_team"], []).append(p["name"])

    result = {}
    for p in players:
        season, season_gp = _fpts(p, "season")
        recent, recent_gp = _fpts(p, "last_15")
        espn = p["projection"]["espn"]["fpts_avg"] if p["projection"].get("espn") else None

        parts = []
        if espn:
            parts.append((espn, W_ESPN))
        if season is not None and season_gp:
            # No ESPN projection (common for free agents): the season average takes its weight,
            # so a hot two weeks doesn't dominate.
            w_season = W_SEASON + (0 if espn else W_ESPN)
            parts.append((season, w_season * min(1.0, season_gp / FULL_SEASON_GP)))
        if recent is not None and recent_gp >= MIN_RECENT_GP:
            parts.append((recent, W_RECENT))
        total_w = sum(w for _, w in parts)
        base = sum(v * w for v, w in parts) / total_w if total_w else 0.0

        # Minutes trend: last 7 days vs the season.
        minutes_factor = 1.0
        s7 = p["stats"].get("last_7") or {}
        ss = p["stats"].get("season") or {}
        if (s7.get("gp") or 0) >= 2 and (ss.get("mpg") or 0) >= 10 and s7.get("mpg"):
            ratio = min(max(s7["mpg"] / ss["mpg"], MINUTES_CLAMP[0]), MINUTES_CLAMP[1])
            minutes_factor = 1 + MINUTES_SENSITIVITY * (ratio - 1)

        teammates = [n for n in out_by_team.get(p["nba_team"], []) if n != p["name"]]
        bump = 1 + min(TEAMMATE_OUT_BUMP * len(teammates), TEAMMATE_OUT_CAP)

        result[p["id"]] = Projection(
            player_id=p["id"],
            per_game=round(max(base, 0.0) * minutes_factor * bump, 2),
            season_gp=season_gp,
            recent_gp=recent_gp,
            season_avg=season,
            recent_avg=recent,
            espn=espn,
            minutes_factor=round(minutes_factor, 3),
            teammates_out=teammates,
        )
    return result


def availability(p: dict[str, Any]) -> float:
    return AVAILABILITY.get(p["injury_status"], 0.8)


def season_availability(p: dict[str, Any]) -> float:
    return SEASON_AVAILABILITY.get(p["injury_status"], 0.9)


def expected_on(p: dict[str, Any], proj: Projection, date: str) -> float:
    """Expected fantasy points from this player's game on `date` (0 if no game)."""
    if date not in p["game_dates_left"]:
        return 0.0
    factor = BACK_TO_BACK if date in p["back_to_back_dates"] else 1.0
    return proj.per_game * availability(p) * factor
