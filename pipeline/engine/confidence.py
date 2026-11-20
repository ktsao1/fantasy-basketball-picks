"""Confidence levels (high / medium / low) with a short, human basis."""

from __future__ import annotations

from typing import Any

from .projection import Projection

ORDER = {"high": 2, "medium": 1, "low": 0}


def _worst(found: list[tuple[str, str]]) -> dict[str, str]:
    if not found:
        return {"level": "high", "basis": "healthy, full sample, form in line with season"}
    level = min(found, key=lambda x: ORDER[x[0]])[0]
    bases = [b for lv, b in found if lv == level]
    return {"level": level, "basis": "; ".join(bases[:2])}


def player_flags(p: dict[str, Any], proj: Projection) -> list[tuple[str, str]]:
    flags = []
    if proj.season_gp < 5:
        flags.append(("low", f"small sample ({proj.season_gp} games)"))
    elif proj.season_gp < 10:
        flags.append(("medium", f"limited sample ({proj.season_gp} games)"))
    status = p["injury_status"]
    if status in ("DAY_TO_DAY", "QUESTIONABLE"):
        flags.append(("medium", "injury status day-to-day"))
    elif status == "DOUBTFUL":
        flags.append(("low", "injury status doubtful"))
    elif status in ("OUT", "INJURY_RESERVE"):
        flags.append(("low", "out, no return date from ESPN"))
    if proj.recent_avg and proj.season_avg and proj.recent_gp >= 3:
        swing = abs(proj.recent_avg - proj.season_avg) / max(proj.season_avg, 1)
        if swing > 0.3:
            flags.append(("medium", "recent form far from season average"))
    return flags


def for_player(p: dict[str, Any], proj: Projection) -> dict[str, str]:
    return _worst(player_flags(p, proj))


def for_choice(players: list[tuple[dict[str, Any], Projection]], margin: float | None) -> dict[str, str]:
    """Confidence in choosing one option over another: player risks plus how close the call is."""
    flags = [f for p, proj in players for f in player_flags(p, proj)]
    if margin is not None:
        if margin < 3:
            flags.append(("low", f"close call (+{margin:.1f} fpts)"))
        elif margin < 6:
            flags.append(("medium", f"modest edge (+{margin:.1f} fpts)"))
    return _worst(flags)
