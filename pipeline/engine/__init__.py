"""Phase 2: projections, start/sit and pickups. Runs inside the pipeline.

recommend() takes the pipeline's JSON (without recommendations) and returns the
recommendations block. Every lineup slot, change and pickup carries a one-line `reason`,
a `confidence` {"level": "high"|"medium"|"low", "basis": str} and ranked `factors`
(see factors.py). Pickups and the matchup projection also carry 80% ranges.
"""

from __future__ import annotations

from math import erf, sqrt
from typing import Any

from . import confidence, factors
from .lineup import BENCH_SLOTS, best_day, labels, starting_slots
from .pickups import recommend_pickups
from .projection import RANGE_Z, availability, expected_on, project_all, variance_on

ENGINE_VERSION = "1.2"


def _context(p: dict[str, Any], proj, date: str) -> list[str]:
    return [f["label"] for f in factors.signals(p, proj, date)]


def _why_not(p: dict[str, Any], date: str) -> str | None:
    """Why a player can't help on `date`, or None if he simply projects lower."""
    if availability(p) == 0:
        return f"is {p['injury_status'].replace('_', ' ').lower()}"
    if date not in p["game_dates_left"]:
        return "has no game"
    return None


def recommend(data: dict[str, Any]) -> dict[str, Any]:
    meta = data["meta"]
    today = meta["today"]
    players = {p["id"]: p for p in data["players"]}
    projections = project_all(data["players"])
    slots = starting_slots(meta["roster_slots"])
    slot_labels = labels(slots)

    def value_of(p, d):
        return expected_on(p, projections[p["id"]], d)

    my_roster = data["my_team"]["roster"]
    my_days = sorted({d for r in my_roster if r["player_id"] in players
                      for d in players[r["player_id"]]["game_dates_left"]})

    # --- daily lineups ------------------------------------------------------
    lineup_out, day_lineups = [], []
    for d in my_days:
        day = best_day(d, my_roster, players, value_of, slots, d == today)
        day_lineups.append(day)
        for label in slot_labels:
            pid = day.assignment.get(label)
            if pid is None:
                lineup_out.append({"date": d, "slot": label, "player_id": None, "projected_fpts": None,
                                   "reason": "No eligible player has a game.",
                                   "confidence": {"level": "high", "basis": "schedule"}, "factors": []})
                continue
            p, proj = players[pid], projections[pid]
            if label in day.locked:
                lineup_out.append({"date": d, "slot": label, "player_id": pid, "projected_fpts": None,
                                   "reason": "Locked: his game has started.",
                                   "confidence": {"level": "high", "basis": "locked by ESPN"}, "factors": []})
                continue
            v = day.values.get(pid, 0.0)
            reason = f"{v:.1f} projected fpts"
            ctx = _context(p, proj, d)
            if ctx:
                reason += " · " + ", ".join(ctx)
            lineup_out.append({"date": d, "slot": label, "player_id": pid, "projected_fpts": round(v, 1),
                               "reason": reason, "confidence": confidence.for_player(p, proj),
                               "factors": factors.signals(p, proj, d)})

    # --- changes vs. the lineup set on ESPN (first remaining day only) --------
    # ESPN carries the lineup as set forward to later days, so every day is diffed against it.
    current = {r["player_id"]: r["lineup_slot"] for r in my_roster}

    def changes_for(first) -> list[dict[str, Any]]:
        changes: list[dict[str, Any]] = []
        rec_slot = {pid: label for label, pid in first.assignment.items() if pid is not None}
        starters_now = {pid for pid, s in current.items() if s and s not in BENCH_SLOTS and pid in players}
        to_start = sorted((pid for pid in rec_slot if pid not in starters_now and pid not in first.locked.values()),
                          key=lambda pid: -first.values.get(pid, 0))
        # Pair each start with whoever holds a slot of that type now and isn't kept there,
        # so the instructions match ESPN's slot-by-slot swaps. Prefer players who can't play.
        occupants: dict[str, list[int]] = {}
        for pid in starters_now:
            occupants.setdefault(current[pid], []).append(pid)
        kept = {(pid, rec_slot[pid].rstrip("0123456789")) for pid in rec_slot}
        used: set[int] = set()
        for pid in to_start:
            p, proj = players[pid], projections[pid]
            v = first.values.get(pid, 0.0)
            slot = rec_slot[pid].rstrip("0123456789")
            options = [o for o in occupants.get(slot, []) if (o, slot) not in kept and o not in used
                       and o not in first.locked.values()]
            options.sort(key=lambda o: (rec_slot.get(o) is not None, first.values.get(o, 0.0)))
            out = players[options[0]] if options else None
            if out:
                used.add(out["id"])
            out_v = first.values.get(out["id"], 0.0) if out else 0.0
            margin = v - out_v
            why = _why_not(out, first.date) if out else None
            if out is None:
                replaces = f" at {slot}"
            elif why:
                replaces = f" at {slot} over {out['name']}, who {why}"
            else:
                replaces = f" at {slot} over {out['name']} ({out_v:.1f} proj)"
            changes.append({
                "action": "start", "player_id": pid, "from_slot": current.get(pid), "to_slot": slot,
                "replaces": out["id"] if out else None,
                "reason": f"Start {p['name']} ({v:.1f} proj){replaces}.",
                "confidence": confidence.for_choice([(p, proj)], margin),
                "factors": factors.for_start(p, proj, v, out, out_v, why, slot, first.date),
            })
            if out and rec_slot.get(out["id"]) is None:
                changes.append({
                    "action": "bench", "player_id": out["id"], "from_slot": current.get(out["id"]), "to_slot": "BE",
                    "reason": f"Bench {out['name']}: {why}." if why
                              else f"Bench {out['name']}: {out_v:.1f} proj vs {v:.1f} for {p['name']}.",
                    "confidence": confidence.for_choice([(p, proj)], margin),
                    "factors": factors.for_start(p, proj, v, out, out_v, why, slot, first.date, benching=True),
                })
        # Starters who stay in but need a different slot to make room.
        for pid, label in rec_slot.items():
            slot = label.rstrip("0123456789")
            if pid in starters_now and current.get(pid) != slot and label not in first.locked:
                changes.append({
                    "action": "move", "player_id": pid, "from_slot": current.get(pid), "to_slot": slot,
                    "reason": f"Move {players[pid]['name']} to {slot} to fit the lineup.",
                    "confidence": {"level": "high", "basis": "slot eligibility"},
                    "factors": [factors.factor("slot", f"only {slot} is open for him after the other changes")],
                })
        return changes

    changes_by_day = {d.date: changes_for(d) for d in day_lineups}
    changes = changes_by_day[day_lineups[0].date] if day_lineups else []

    # --- matchup projection --------------------------------------------------
    # Totals are today's score plus the best remaining lineups; the spread comes from each
    # starter's game-to-game variance (independent games), giving 80% ranges and P(win).
    def spread(days) -> float:
        return sum(variance_on(players[pid], projections[pid], day.date)
                   for day in days for label, pid in day.assignment.items()
                   if pid is not None and label not in day.locked)

    def band(total: float, var: float) -> list[float]:
        return [round(total - RANGE_Z * sqrt(var), 1), round(total + RANGE_Z * sqrt(var), 1)]

    m = data["matchup"]
    mine = (m["my_score"] or 0) + sum(d.total for d in day_lineups)
    mine_var = spread(day_lineups)
    projection = {"mine": round(mine, 1), "opponent": None, "mine_range": band(mine, mine_var),
                  "opponent_range": None, "win_probability": None}
    opp_lineups = []
    if data["opponent"]:
        opp_roster = data["opponent"]["roster"]
        opp_days = sorted({d for r in opp_roster if r["player_id"] in players
                           for d in players[r["player_id"]]["game_dates_left"]})
        opp_lineups = [best_day(d, opp_roster, players, value_of, slots, d == today) for d in opp_days]
        opp = (m["opponent_score"] or 0) + sum(d.total for d in opp_lineups)
        opp_var = spread(opp_lineups)
        projection["opponent"] = round(opp, 1)
        projection["opponent_range"] = band(opp, opp_var)
        sd = sqrt(mine_var + opp_var)
        p_win = (1.0 if mine > opp else 0.0 if mine < opp else 0.5) if sd == 0 \
            else 0.5 * (1 + erf((mine - opp) / (sd * sqrt(2))))
        projection["win_probability"] = round(p_win, 3)

    return {
        "engine_version": ENGINE_VERSION,
        "lineup": lineup_out,
        "changes": changes,
        "changes_by_day": changes_by_day,
        # The opponent's best lineup per remaining day: what the Matchup page compares against.
        "opponent_lineup": [
            {"date": day.date, "slot": label, "player_id": pid,
             "projected_fpts": None if pid is None or label in day.locked else round(day.values.get(pid, 0.0), 1)}
            for day in opp_lineups for label in slot_labels for pid in [day.assignment.get(label)]
        ],
        "pickups": recommend_pickups(data, players, projections, value_of, slots),
        "matchup_projection": projection,
        "player_projections": {
            pid: {"per_game": proj.per_game,
                  "week": round(sum(value_of(players[pid], d) for d in players[pid]["game_dates_left"]), 1)}
            for pid, proj in projections.items()
        },
    }
