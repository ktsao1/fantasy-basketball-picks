"""Pickups: for each free agent, the best player to drop and the gain from the swap.

Gain this week = best remaining lineups with the swap − without it, counted from the day
the add takes effect (adds lock at the day's first game; waiver claims take a day longer).
Gain rest of season = projected fpts per game × games left × expected availability, add
minus drop, times the share of games a roster player typically starts.

Each pickup also carries ranked `factors` (what the week gain is made of) and an 80% range
for the week gain, from both players' game-to-game variance over the days that count.
"""

from __future__ import annotations

from datetime import date, timedelta
from math import sqrt
from typing import Any

from . import confidence, factors
from .lineup import best_day
from .projection import RANGE_Z, Projection, season_availability, variance_on

START_SHARE = 0.85          # rough share of a rostered player's games that count
DROP_CANDIDATES = 5         # weakest roster players considered as drops
FA_CANDIDATES = 30          # best free agents (by rest-of-season value) evaluated in full
TOP_N = 5
MIN_SCORE = 1.0             # don't recommend swaps worth less than ~1 fpt/week
MAX_CENTERS = 4


def ros_value(p: dict[str, Any], proj: Projection) -> float:
    return proj.per_game * p["games_left_season"] * season_availability(p) * START_SHARE


def _week_total(roster, players, value_of, slots, days, today) -> float:
    return sum(best_day(d, roster, players, value_of, slots, d == today).total for d in days)


def recommend_pickups(data, players, projections, value_of, slots) -> list[dict[str, Any]]:
    meta = data["meta"]
    today = meta["today"]
    roster = data["my_team"]["roster"]
    mine = [players[r["player_id"]] for r in roster if r["player_id"] in players]
    weeks_left = max(1, meta["regular_season_weeks"] - meta["matchup_period"] + 1)
    all_days = sorted({d for p in mine for d in p["game_dates_left"]} |
                      {d for p in players.values() if p["owner"] is None for d in p["game_dates_left"]})

    # Drop candidates: lowest rest-of-season value, never someone on IR (no roster spot gained).
    droppable = sorted(
        (p for p in mine if next(r for r in roster if r["player_id"] == p["id"])["lineup_slot"] != "IR"),
        key=lambda p: ros_value(p, projections[p["id"]]),
    )[:DROP_CANDIDATES]

    free_agents = [p for p in players.values() if p["owner"] is None]
    free_agents.sort(key=lambda p: -ros_value(p, projections[p["id"]]))
    free_agents = free_agents[:FA_CANDIDATES]

    centers = sum(1 for p in mine if p["primary_position"] == "C")
    results = []
    for fa in free_agents:
        if fa["injury_status"] in ("OUT", "INJURY_RESERVE", "SUSPENSION"):
            continue
        waiver = fa.get("free_agent_status") == "WAIVERS"
        start = date.fromisoformat(meta["adds_effective_date"]) + timedelta(days=1 if waiver else 0)
        days = [d for d in all_days if d >= start.isoformat()]
        base = _week_total(roster, players, value_of, slots, days, today)

        best = None
        for drop in droppable:
            c = centers - (drop["primary_position"] == "C") + (fa["primary_position"] == "C")
            if c > MAX_CENTERS:
                continue
            # Never drop a better player: injuries without return dates make rest-of-season
            # value too uncertain to justify cutting someone who projects higher per game.
            if projections[drop["id"]].per_game >= projections[fa["id"]].per_game:
                continue
            swapped = [r for r in roster if r["player_id"] != drop["id"]] + [{"player_id": fa["id"], "lineup_slot": "BE"}]
            gain_week = _week_total(swapped, players, value_of, slots, days, today) - base
            gain_ros = ros_value(fa, projections[fa["id"]]) - ros_value(drop, projections[drop["id"]])
            score = gain_week + gain_ros / weeks_left
            if best is None or score > best[0]:
                best = (score, drop, gain_week, gain_ros)
        if best and best[0] >= MIN_SCORE:
            results.append((fa, *best, waiver, days))

    results.sort(key=lambda r: -r[1])
    out = []
    for fa, score, drop, gain_week, gain_ros, waiver, days in results[:TOP_N]:
        pf, pd = projections[fa["id"]], projections[drop["id"]]
        fa_games = sum(1 for d in fa["game_dates_left"] if d in days)
        drop_games = sum(1 for d in drop["game_dates_left"] if d in days)
        bits = [f"{pf.per_game:.1f} vs {pd.per_game:.1f} proj fpts/g"]
        if fa_games != drop_games:
            bits.append(f"{fa_games} game{'s' if fa_games != 1 else ''} left this week vs {drop_games}")
        if pf.recent_avg is not None and pf.recent_gp >= 3:
            bits.append(f"{pf.recent_avg:.1f} over the last 15 days")
        if waiver:
            bits.append("on waivers, so it takes a day to clear")
        conf = confidence.for_choice([(fa, pf)], margin=score)
        sd = sqrt(sum(variance_on(fa, pf, d) for d in days) + sum(variance_on(drop, pd, d) for d in days))
        out.append(
            {
                "add_player_id": fa["id"],
                "drop_player_id": drop["id"],
                "gain_this_week": round(gain_week, 1),
                "gain_this_week_range": [round(gain_week - RANGE_Z * sd, 1), round(gain_week + RANGE_Z * sd, 1)],
                "gain_rest_of_season": round(gain_ros, 1),
                "reason": f"Swap for {drop['name']}: " + ", ".join(bits) + ".",
                "confidence": conf,
                "factors": factors.for_swap(fa, drop, pf, pd, days, gain_week, waiver),
            }
        )
    return out
