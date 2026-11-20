"""Structured reasons ("factors") behind each recommendation, for the dashboard to rank and draw.

A factor is {key, label, value, compare, unit, impact_fpts}:
- `label` is the human phrase; the plain-text `reason` is built from the same phrases.
- `value` / `compare` are the subject's figure and what it's measured against (the dropped or
  benched player, or the season average), so the UI can draw a small comparison. Chance of
  playing is in percent (unit "%").
- `impact_fpts` is the factor's signed contribution to the recommendation's payoff. Driver
  factors carry one; supporting signals (form, minutes, usage) have None.

`ranked()` orders drivers by |impact|, then signals in a fixed order.
"""

from __future__ import annotations

from typing import Any

from .projection import Projection, availability, expected_on, healthy_on

MIN_IMPACT = 0.5     # drop driver factors smaller than this (fpts)
MIN_RESIDUAL = 1.0   # show "lineup fit" only when the solver's result differs by this much


def factor(key: str, label: str, value: float | None = None, compare: float | None = None,
           unit: str | None = None, impact: float | None = None) -> dict[str, Any]:
    r = lambda x: None if x is None else round(float(x), 1)
    return {"key": key, "label": label, "value": r(value), "compare": r(compare), "unit": unit,
            "impact_fpts": r(impact)}


def ranked(factors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    drivers = sorted((f for f in factors if f["impact_fpts"] is not None), key=lambda f: -abs(f["impact_fpts"]))
    return drivers + [f for f in factors if f["impact_fpts"] is None]


def _status(p: dict[str, Any]) -> str:
    return (p["injury_status"] or "active").replace("_", " ").lower()


def signals(p: dict[str, Any], proj: Projection, date: str | None = None) -> list[dict[str, Any]]:
    """Supporting context for one player: recent form, minutes, usage, back-to-back, injury."""
    out = []
    if proj.recent_avg is not None and proj.recent_gp >= 3:
        out.append(factor("form", f"{proj.recent_avg:.1f} over the last 15 days",
                          proj.recent_avg, proj.season_avg, "fpts/g"))
    mpg7 = (p["stats"].get("last_7") or {}).get("mpg")
    mpg = (p["stats"].get("season") or {}).get("mpg")
    if proj.minutes_factor >= 1.03:
        out.append(factor("minutes", "minutes trending up", mpg7, mpg, "mpg"))
    elif proj.minutes_factor <= 0.97:
        out.append(factor("minutes", "minutes trending down", mpg7, mpg, "mpg"))
    if proj.teammates_out:
        out.append(factor("usage", f"more usage with {proj.teammates_out[0]} out"))
    if date and date in p["back_to_back_dates"]:
        out.append(factor("back_to_back", "second night of a back-to-back"))
    if p["injury_status"] == "DAY_TO_DAY":
        out.append(factor("injury", "day-to-day", 100 * availability(p), 100, "%"))
    return out


def for_swap(fa: dict[str, Any], drop: dict[str, Any], pf: Projection, pd: Projection,
             days: list[str], gain_week: float, waiver: bool) -> list[dict[str, Any]]:
    """Why adding `fa` for `drop` gains `gain_week` this week, split into additive parts.

    per-game quality on days both play + extra games + injury discounts, and a "lineup fit"
    remainder for whatever the lineup solver does differently (full slots on busy days, etc.).
    """
    fa_days = [d for d in days if d in fa["game_dates_left"]]
    drop_days = [d for d in days if d in drop["game_dates_left"]]
    both = [d for d in fa_days if d in drop_days]
    only_fa = [d for d in fa_days if d not in drop_days]
    only_drop = [d for d in drop_days if d not in fa_days]

    per_game = sum(healthy_on(fa, pf, d) - healthy_on(drop, pd, d) for d in both)
    schedule = (sum(healthy_on(fa, pf, d) for d in only_fa)
                - sum(healthy_on(drop, pd, d) for d in only_drop))
    avail_fa = sum(expected_on(fa, pf, d) - healthy_on(fa, pf, d) for d in fa_days)
    avail_drop = -sum(expected_on(drop, pd, d) - healthy_on(drop, pd, d) for d in drop_days)

    fs = [factor("per_game", f"{pf.per_game:.1f} vs {pd.per_game:.1f} proj fpts/g",
                 pf.per_game, pd.per_game, "fpts/g", per_game if both else None)]
    if len(fa_days) != len(drop_days) or abs(schedule) >= MIN_IMPACT:
        n, m = len(fa_days), len(drop_days)
        fs.append(factor("schedule", f"{n} game{'s' if n != 1 else ''} left this week vs {m}",
                         n, m, "games", schedule))
    if abs(avail_drop) >= MIN_IMPACT:
        fs.append(factor("availability", f"{drop['name']} is {_status(drop)}",
                         100 * availability(drop), 100, "%", avail_drop))
    if abs(avail_fa) >= MIN_IMPACT:
        fs.append(factor("availability", f"{fa['name']} is {_status(fa)}",
                         100 * availability(fa), 100, "%", avail_fa))
    residual = gain_week - (per_game + schedule + avail_fa + avail_drop)
    if abs(residual) >= MIN_RESIDUAL:
        label = ("some of his games fall on days your lineup is already full" if residual < 0
                 else "lets the lineup use its slots better on other days")
        fs.append(factor("lineup_fit", label, None, None, None, residual))
    fs += [f for f in signals(fa, pf) if f["key"] != "injury"]
    if waiver:
        fs.append(factor("waivers", "on waivers, so it takes a day to clear"))
    return ranked(fs)


def for_start(p: dict[str, Any], proj: Projection, v: float, out: dict[str, Any] | None,
              out_v: float, why: str | None, slot: str, date: str, benching: bool = False) -> list[dict[str, Any]]:
    """Factors for a start (or the paired bench): today's projection vs. the other player."""
    margin = v - out_v
    if out is None:
        fs = [factor("projection", f"{v:.1f} projected at {slot}", v, None, "fpts", v)]
    elif benching:
        fs = [factor("projection", f"{out_v:.1f} vs {v:.1f} projected for {p['name']}",
                     out_v, v, "fpts", margin)]
    else:
        fs = [factor("projection", f"{v:.1f} vs {out_v:.1f} projected for {out['name']}",
                     v, out_v, "fpts", margin)]
    if out is not None and why:
        fs.append(factor("availability", f"{out['name']} {why}"))
    if not benching:
        fs += signals(p, proj, date)
    return ranked(fs)
