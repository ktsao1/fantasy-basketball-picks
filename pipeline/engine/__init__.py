"""Phase 2: projections, start/sit and pickups. Runs inside the pipeline.

recommend() takes the pipeline's JSON (without recommendations) and returns the
recommendations block. Every lineup slot, change and pickup carries a one-line `reason`
and a `confidence` {"level": "high"|"medium"|"low", "basis": str}.
"""

from __future__ import annotations

from typing import Any

from . import confidence
from .lineup import BENCH_SLOTS, best_day, labels, starting_slots
from .pickups import recommend_pickups
from .projection import availability, expected_on, project_all

ENGINE_VERSION = "1.0"


def _context(p: dict[str, Any], proj, date: str) -> list[str]:
    bits = []
    if proj.recent_avg is not None and proj.recent_gp >= 3:
        bits.append(f"{proj.recent_avg:.1f} over the last 15 days")
    if proj.minutes_factor >= 1.03:
        bits.append("minutes trending up")
    elif proj.minutes_factor <= 0.97:
        bits.append("minutes trending down")
    if proj.teammates_out:
        bits.append(f"more usage with {proj.teammates_out[0]} out")
    if date in p["back_to_back_dates"]:
        bits.append("second night of a back-to-back")
    if p["injury_status"] == "DAY_TO_DAY":
        bits.append("day-to-day")
    return bits


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
                                   "confidence": {"level": "high", "basis": "schedule"}})
                continue
            p, proj = players[pid], projections[pid]
            if label in day.locked:
                lineup_out.append({"date": d, "slot": label, "player_id": pid, "projected_fpts": None,
                                   "reason": "Locked: his game has started.",
                                   "confidence": {"level": "high", "basis": "locked by ESPN"}})
                continue
            v = day.values.get(pid, 0.0)
            reason = f"{v:.1f} projected fpts"
            ctx = _context(p, proj, d)
            if ctx:
                reason += " · " + ", ".join(ctx)
            lineup_out.append({"date": d, "slot": label, "player_id": pid, "projected_fpts": round(v, 1),
                               "reason": reason, "confidence": confidence.for_player(p, proj)})

    # --- changes vs. the lineup set on ESPN (first remaining day only) --------
    changes = []
    if day_lineups:
        first = day_lineups[0]
        current = {r["player_id"]: r["lineup_slot"] for r in my_roster}
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
                "reason": f"Start {p['name']} ({v:.1f} proj){replaces}.",
                "confidence": confidence.for_choice([(p, proj)], margin),
            })
            if out and rec_slot.get(out["id"]) is None:
                changes.append({
                    "action": "bench", "player_id": out["id"], "from_slot": current.get(out["id"]), "to_slot": "BE",
                    "reason": f"Bench {out['name']}: {why}." if why
                              else f"Bench {out['name']}: {out_v:.1f} proj vs {v:.1f} for {p['name']}.",
                    "confidence": confidence.for_choice([(p, proj)], margin),
                })
        # Starters who stay in but need a different slot to make room.
        for pid, label in rec_slot.items():
            slot = label.rstrip("0123456789")
            if pid in starters_now and current.get(pid) != slot and label not in first.locked:
                changes.append({
                    "action": "move", "player_id": pid, "from_slot": current.get(pid), "to_slot": slot,
                    "reason": f"Move {players[pid]['name']} to {slot} to fit the lineup.",
                    "confidence": {"level": "high", "basis": "slot eligibility"},
                })

    # --- matchup projection --------------------------------------------------
    m = data["matchup"]
    mine_rest = sum(d.total for d in day_lineups)
    projection = {"mine": round((m["my_score"] or 0) + mine_rest, 1), "opponent": None}
    if data["opponent"]:
        opp_roster = data["opponent"]["roster"]
        opp_days = sorted({d for r in opp_roster if r["player_id"] in players
                           for d in players[r["player_id"]]["game_dates_left"]})
        opp_rest = sum(best_day(d, opp_roster, players, value_of, slots, d == today).total for d in opp_days)
        projection["opponent"] = round((m["opponent_score"] or 0) + opp_rest, 1)

    return {
        "engine_version": ENGINE_VERSION,
        "lineup": lineup_out,
        "changes": changes,
        "pickups": recommend_pickups(data, players, projections, value_of, slots),
        "matchup_projection": projection,
        "player_projections": {
            pid: {"per_game": proj.per_game,
                  "week": round(sum(value_of(players[pid], d) for d in players[pid]["game_dates_left"]), 1)}
            for pid, proj in projections.items()
        },
    }
