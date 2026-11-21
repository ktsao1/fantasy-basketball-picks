"""Phase 4: how accurate the engine has been.

The snapshots in data/snapshots/ are already the log of every recommendation: each run
commits one. This script reads them, keeps each start call's last projection made before
his game tipped off, and grades it against what ESPN says he actually scored.

    calls    one per (day, starter): projected fpts, an 80% range, actual fpts once graded
    weeks    each matchup week's projected final and win probability over time, and the result

Actual points come from ESPN's daily box scores (read-only) and are cached in
data/actuals.json, so a day is fetched once. The same box scores give each team's lineup
that day (who sat in which slot), cached in data/lineups.json for the dashboard's past days.
Writes data/track_record.json.

    python track_record.py            fetch missing actuals, then write the record
    python track_record.py --offline  rebuild from the cache only (no ESPN calls)
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from math import sqrt
from pathlib import Path
from typing import Any

from engine.projection import RANGE_Z, project_all, variance_on

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SNAPSHOTS = DATA / "snapshots"
ACTUALS = DATA / "actuals.json"
LINEUPS = DATA / "lineups.json"
OUT = DATA / "track_record.json"


def _load(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None


def snapshots() -> list[dict[str, Any]]:
    """Every snapshot with real recommendations, oldest first."""
    snaps = []
    for f in sorted(SNAPSHOTS.glob("20*.json")):
        d = _load(f)
        if not d or not d.get("recommendations", {}).get("lineup"):
            continue  # stub-engine runs carry no calls
        d["_file"] = f.name
        snaps.append(d)
    return sorted(snaps, key=lambda d: d["meta"]["updated_at"])


def tip_times(snaps: list[dict[str, Any]]) -> dict[tuple[int, str], str]:
    """(player, day) → tip-off instant, from any snapshot that knows it (engine ≥ 1.2)."""
    tips: dict[tuple[int, str], str] = {}
    for s in snaps:
        for p in s["players"]:
            for g in p.get("week_games") or []:
                if g.get("start_utc"):
                    tips[(p["id"], g["date"])] = g["start_utc"]
    return tips


def calls(snaps: list[dict[str, Any]]) -> dict[tuple[int, str], dict[str, Any]]:
    """The last projection for each recommended starter made before his game started."""
    tips = tip_times(snaps)
    out: dict[tuple[int, str], dict[str, Any]] = {}
    for s in snaps:
        made = s["meta"]["updated_at"]
        players = {p["id"]: p for p in s["players"]}
        try:
            projections = project_all(s["players"])
        except (KeyError, TypeError):
            projections = {}
        for slot in s["recommendations"]["lineup"]:
            pid, day, v = slot.get("player_id"), slot.get("date"), slot.get("projected_fpts")
            if pid is None or day is None or v is None or pid not in players:
                continue
            tip = tips.get((pid, day))
            if tip and made >= tip:
                continue  # made after tip-off: not a prediction
            p = players[pid]
            try:
                sd = sqrt(variance_on(p, projections[pid], day)) if pid in projections else 0.35 * v
            except (KeyError, TypeError):
                sd = 0.35 * v
            out[(pid, day)] = {
                "date": day, "player_id": pid, "name": p["name"], "nba_team": p["nba_team"],
                "slot": slot["slot"].rstrip("0123456789"),
                "projected": round(v, 1),
                "range": [round(max(0.0, v - RANGE_Z * sd), 1), round(v + RANGE_Z * sd, 1)],
                "made_at": made, "tip_utc": tip,
            }
    return out


def scoring_periods(snaps: list[dict[str, Any]]) -> dict[str, tuple[int, int]]:
    """Day → (matchup period, ESPN scoring period). Scoring periods count days from opening night."""
    out: dict[str, tuple[int, int]] = {}
    for s in snaps:
        m = s["meta"]
        sp_today = m.get("scoring_period")
        if sp_today is None:
            continue
        today = datetime.fromisoformat(m["today"]).date()
        for d in m.get("matchup_days", []):
            offset = (datetime.fromisoformat(d).date() - today).days
            out[d] = (m["matchup_period"], sp_today + offset)
    return out


def fetch_actuals(
    days: dict[str, tuple[int, int]], cache: dict[str, dict[str, float]], lineups: dict[str, dict[str, Any]],
) -> tuple[dict[str, dict[str, float]], dict[str, dict[str, Any]]]:
    """Fill in finished days missing from either cache, from ESPN's daily box scores.

    cache:   day → player id → fantasy points
    lineups: day → team id → player id → {slot, name, nba_team}, so a past day can show
             that day's roster and which players counted (not the roster as it is now)
    """
    import espn_client as espn  # needs the cookies; imported only when fetching

    today = datetime.now(espn.ET).date().isoformat()
    todo = [d for d in sorted(days) if d < today and (d not in cache or d not in lineups)]
    if not todo:
        return cache, lineups
    league = espn.connect()
    for d in todo:
        mp, sp = days[d]
        try:
            boxes = league.box_scores(matchup_period=mp, scoring_period=sp, matchup_total=False)
        except Exception as e:  # noqa: BLE001 - a missing day just stays ungraded
            print(f"track_record: no box scores for {d} ({type(e).__name__}: {e})")
            continue
        pts: dict[str, float] = {}
        teams: dict[str, dict[str, Any]] = {}
        for b in boxes:
            for team, lineup in ((b.home_team, b.home_lineup), (b.away_team, b.away_lineup)):
                # The library swaps the team id for a Team object; a bye stays 0.
                tid = getattr(team, "team_id", team) or None
                for pl in lineup or []:
                    if pl.points is not None:
                        pts[str(pl.playerId)] = round(float(pl.points), 1)
                    if tid is not None:
                        teams.setdefault(str(tid), {})[str(pl.playerId)] = {
                            "slot": pl.slot_position, "name": pl.name, "nba_team": pl.proTeam,
                        }
        if pts and d not in cache:
            cache[d] = pts
            print(f"track_record: graded {d} ({len(pts)} players)")
        if teams:
            lineups[d] = teams
            print(f"track_record: saved lineups for {d} ({len(teams)} teams)")
    return cache, lineups


def weeks(snaps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Each week's projected final over time; the result once a later week has begun."""
    by_week: dict[int, dict[str, Any]] = {}
    for s in snaps:
        m, mp = s["matchup"], s["meta"]["matchup_period"]
        proj = s["recommendations"].get("matchup_projection") or m.get("projected") or {}
        w = by_week.setdefault(mp, {"matchup_period": mp, "opponent": (s.get("opponent") or {}).get("name"),
                                    "points": [], "final": None})
        if proj.get("mine") is None:
            continue
        w["points"].append({
            "at": s["meta"]["updated_at"], "score_mine": m.get("my_score"), "score_opponent": m.get("opponent_score"),
            "projected_mine": proj.get("mine"), "projected_opponent": proj.get("opponent"),
            "win_probability": proj.get("win_probability"),
        })
    # A week is final once a snapshot from a later week exists; its last run holds the final score.
    latest = max(by_week) if by_week else None
    for mp, w in by_week.items():
        if latest is not None and mp < latest and w["points"]:
            last = w["points"][-1]
            w["final"] = {"mine": last["score_mine"], "opponent": last["score_opponent"]}
    return [by_week[k] for k in sorted(by_week)]


def build(snaps: list[dict[str, Any]], actuals: dict[str, dict[str, float]]) -> dict[str, Any]:
    rows = []
    for c in sorted(calls(snaps).values(), key=lambda c: (c["date"], -c["projected"])):
        day = actuals.get(c["date"])
        a = day.get(str(c["player_id"])) if day else None
        c["actual"] = a
        # A finished day where ESPN has no score for him (left the roster, or no box score): ungradable.
        c["status"] = "graded" if a is not None else "no_score" if day else "pending"
        rows.append(c)
    graded = [c for c in rows if c["actual"] is not None]
    n = len(graded)
    summary = {
        "graded": n,
        "pending": sum(1 for c in rows if c["status"] == "pending"),
        "no_score": sum(1 for c in rows if c["status"] == "no_score"),
        "days_graded": sorted({c["date"] for c in graded}),
        "mean_abs_error": round(sum(abs(c["actual"] - c["projected"]) for c in graded) / n, 1) if n else None,
        "bias": round(sum(c["actual"] - c["projected"] for c in graded) / n, 1) if n else None,
        "within_range": sum(1 for c in graded if c["range"][0] <= c["actual"] <= c["range"][1]),
        "projected_total": round(sum(c["projected"] for c in graded), 1),
        "actual_total": round(sum(c["actual"] for c in graded), 1),
    }
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "snapshots": len(snaps),
        "first_snapshot": snaps[0]["meta"]["updated_at"] if snaps else None,
        "summary": summary,
        "calls": rows,
        "weeks": weeks(snaps),
    }


def main() -> int:
    snaps = snapshots()
    cache = _load(ACTUALS) or {}
    lineups = _load(LINEUPS) or {}
    if "--offline" not in sys.argv:
        try:
            cache, lineups = fetch_actuals(scoring_periods(snaps), cache, lineups)
            ACTUALS.write_text(json.dumps(cache, sort_keys=True, separators=(",", ":")) + "\n")
            LINEUPS.write_text(json.dumps(lineups, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n")
        except Exception as e:  # noqa: BLE001 - the record still builds from the cache
            print(f"track_record: couldn't fetch actuals ({type(e).__name__}: {e}); using the cache.")
    record = build(snaps, cache)
    OUT.write_text(json.dumps(record, separators=(",", ":"), ensure_ascii=False) + "\n")
    s = record["summary"]
    print(f"track_record: {s['graded']} graded calls, {s['pending']} pending, "
          f"{s['within_range']}/{s['graded']} inside the 80% range.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
