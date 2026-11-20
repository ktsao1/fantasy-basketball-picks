"""Daily lineup optimizer.

Lineups lock per game, so the engine picks the best legal lineup for each remaining day.
The roster is small (≤14 players, 10 starting slots), so it solves exactly with a DP over
players × used slots instead of a greedy fill or an LP solver.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

BENCH_SLOTS = {"BE", "IR"}
KEEP_SLOT_BONUS = 0.01  # tie-break: among equal lineups, keep players where they are


@dataclass
class DayLineup:
    date: str
    assignment: dict[str, int | None]   # slot label (e.g. "UT2") → player id or None
    values: dict[int, float]            # player id → expected fpts that day
    locked: dict[str, int]              # slots held by players whose game already started
    total: float


def starting_slots(roster_slots: dict[str, int]) -> list[str]:
    """['PG','SG',...,'UT','UT','UT'] in ESPN order, bench/IR excluded."""
    order = ["PG", "SG", "SF", "PF", "C", "G", "F", "SG/SF", "G/F", "PF/C", "F/C", "UT"]
    out = []
    for s in order:
        out += [s] * roster_slots.get(s, 0)
    for s, n in roster_slots.items():  # anything unexpected, appended rather than dropped
        if s not in order and s not in BENCH_SLOTS:
            out += [s] * n
    return out


def labels(slots: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for s in slots:
        seen[s] = seen.get(s, 0) + 1
        out.append(s if slots.count(s) == 1 else f"{s}{seen[s]}")
    return out


def solve(candidates: list[tuple[int, float, list[str], str | None]], slots: list[str]) -> tuple[float, dict[int, int]]:
    """Max total value. candidates: (player_id, value, eligible slot types, current slot).

    Returns (total, {slot_index: player_id}). Total excludes the keep-slot tie-break.
    """
    n = len(slots)
    # Identical slot types are interchangeable: fill the lowest free index of a type.
    by_type: dict[str, list[int]] = {}
    for i, s in enumerate(slots):
        by_type.setdefault(s, []).append(i)

    states: dict[int, tuple[float, tuple[tuple[int, int], ...]]] = {0: (0.0, ())}
    for pid, value, elig, current in sorted(candidates, key=lambda c: -c[1]):
        if value <= 0:
            continue
        nxt = dict(states)
        for mask, (total, picks) in states.items():
            for t in elig:
                for i in by_type.get(t, []):
                    if not mask & (1 << i):
                        new_mask = mask | (1 << i)
                        bonus = KEEP_SLOT_BONUS if t == current else 0.0
                        cand = (total + value + bonus, picks + ((i, pid),))
                        if new_mask not in nxt or nxt[new_mask][0] < cand[0]:
                            nxt[new_mask] = cand
                        break  # first free slot of this type is enough
        states = nxt
        if len(states) > 1 << n:  # can't happen, but keeps the DP bounded
            break
    _, best_picks = max(states.values(), key=lambda v: v[0])
    value = {c[0]: c[1] for c in candidates}
    return sum(value[pid] for _, pid in best_picks), {i: pid for i, pid in best_picks}


def best_day(
    date: str,
    roster: list[dict[str, Any]],
    players: dict[int, dict[str, Any]],
    value_of,
    slots: list[str],
    is_today: bool,
) -> DayLineup:
    """Best lineup for one day. On today, players whose game started stay where they are."""
    slot_labels = labels(slots)
    open_slots = list(range(len(slots)))
    locked: dict[str, int] = {}
    candidates = []
    for r in roster:
        p = players.get(r["player_id"])
        if not p or r["lineup_slot"] == "IR":
            continue
        if is_today and p["game_today_locked"]:
            cur = r["lineup_slot"]
            if cur and cur not in BENCH_SLOTS:
                # Hold the first matching open slot of his current type.
                for i in open_slots:
                    if slots[i] == cur:
                        open_slots.remove(i)
                        locked[slot_labels[i]] = p["id"]
                        break
            continue
        elig = [s for s in set(p["positions"]) if s in slots]
        candidates.append((p["id"], value_of(p, date), elig, r["lineup_slot"]))

    sub_slots = [slots[i] for i in open_slots]
    total, picks = solve(candidates, sub_slots)
    assignment: dict[str, int | None] = {slot_labels[i]: None for i in range(len(slots))}
    assignment.update(locked)
    for j, pid in picks.items():
        assignment[slot_labels[open_slots[j]]] = pid
    values = {c[0]: c[1] for c in candidates}
    return DayLineup(date=date, assignment=assignment, values=values, locked=locked, total=round(total, 2))


def week_total(roster, players, value_of, slots, days: list[str], today: str) -> float:
    return sum(best_day(d, roster, players, value_of, slots, d == today).total for d in days)
