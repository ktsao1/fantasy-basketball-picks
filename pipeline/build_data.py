"""Pipeline entry point: fetch (ESPN) → engine → validate → write JSON.

    .venv/bin/python pipeline/build_data.py           # write data/latest.json + a snapshot
    .venv/bin/python pipeline/build_data.py --check   # only check that ESPN answers; writes nothing
    .venv/bin/python pipeline/build_data.py --dry-run # build and validate, print a summary, write nothing

Env: ESPN_S2, SWID (from .env locally, GitHub secrets in Actions), ANONYMIZE (default true).

Safety: output goes to a temp file, is validated against schema.json and sanity-checked,
and only then replaces data/latest.json. Any failure exits non-zero and leaves the
existing data untouched. Nothing here prints the cookies.
"""

from __future__ import annotations

import json
import os
import string
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import jsonschema

import espn_client as espn
from engine import recommend

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
LATEST = DATA / "latest.json"
SNAPSHOTS = DATA / "snapshots"
SCHEMA = json.loads((Path(__file__).parent / "schema.json").read_text())

OUTPUT_FREE_AGENTS = 50
STAT_KEYS = ("PTS", "REB", "AST", "STL", "BLK", "3PM", "FGM", "FGA", "FTM", "FTA", "TO", "MPG")
SPLIT_NAMES = {"total": "season", "last_7": "last_7", "last_15": "last_15", "last_30": "last_30"}


def env_flag(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    return default if v is None else v.strip().lower() in ("1", "true", "yes", "on")


def gh_error(message: str) -> None:
    """Print an error; inside GitHub Actions it also shows as an annotation on the run."""
    prefix = "::error title=Pipeline failed::" if os.environ.get("GITHUB_ACTIONS") else "ERROR: "
    print(prefix + message, file=sys.stderr)


# --- transform -------------------------------------------------------------

def _stat_line(row: dict[str, Any]) -> dict[str, Any]:
    avg = row.get("avg") or {}
    return {
        "fpts_avg": row.get("fpts_avg"),
        "fpts_total": row.get("fpts_total"),
        "gp": row.get("gp"),
        "mpg": row.get("mpg"),
        "avg": {k: round(float(avg[k]), 2) for k in STAT_KEYS if isinstance(avg.get(k), (int, float))},
    }


def _team_aliases(teams: list[dict], my_team_id: int, anonymize: bool) -> dict[int, tuple[str, str]]:
    """team_id → (name, abbrev). Others become Opponent A–H, ordered by team_id so letters stay stable."""
    out = {}
    others = sorted(t["team_id"] for t in teams if t["team_id"] != my_team_id)
    letters = dict(zip(others, string.ascii_uppercase))
    for t in teams:
        if anonymize and t["team_id"] != my_team_id:
            letter = letters[t["team_id"]]
            out[t["team_id"]] = (f"Opponent {letter}", f"OP{letter}")
        else:
            out[t["team_id"]] = (t["name"], t["abbrev"])
    return out


def build(snap: dict[str, Any], anonymize: bool, now: datetime) -> dict[str, Any]:
    me = snap["my_team_id"]
    period = snap["current_matchup_period"]
    aliases = _team_aliases(snap["teams"], me, anonymize)

    # This week's remaining games, per NBA team.
    week_days = set(snap["matchup_periods"].get(period, []))
    now_iso = now.isoformat()
    dates_left: dict[str, list[str]] = {}
    day_dates: dict[int, str] = {}
    for g in snap["pro_games"]:
        if g["scoring_period"] in week_days:
            day_dates.setdefault(g["scoring_period"], g["game_date"])
            if g["start_utc"] > now_iso:
                for team in (g["home_team"], g["away_team"]):
                    dates_left.setdefault(team, []).append(g["game_date"])

    # Players: everyone rostered + the top free agents.
    owner = {r["player_id"]: r["team_id"] for r in snap["rosters"]}
    fa_rank = {f["player_id"]: f["rank"] for f in snap["free_agents"] if f["rank"] <= OUTPUT_FREE_AGENTS}
    keep = set(owner) | set(fa_rank)
    stats: dict[int, dict[str, Any]] = {}
    for s in snap["player_stats"]:
        stats.setdefault(s["player_id"], {})[s["split"]] = s

    players = []
    for p in snap["players"]:
        pid = p["player_id"]
        if pid not in keep:
            continue
        ps = stats.get(pid, {})
        players.append(
            {
                "id": pid,
                "name": p["name"],
                "nba_team": p["pro_team"],
                "positions": p["eligible_slots"],
                "injury_status": p["injury_status"],
                "expected_return": p["expected_return"],
                "owner": owner.get(pid),
                "free_agent_rank": fa_rank.get(pid),
                "stats": {name: _stat_line(ps[split]) for split, name in SPLIT_NAMES.items() if split in ps},
                "projection": {
                    "espn": _stat_line(ps["projected"]) if "projected" in ps else None,
                    "engine_fpts_per_game": None,
                },
                "games_left_this_week": len(dates_left.get(p["pro_team"], [])),
                "game_dates_left": sorted(dates_left.get(p["pro_team"], [])),
            }
        )
    players.sort(key=lambda x: (x["owner"] is None, x["owner"] or 0, x["free_agent_rank"] or 0, x["name"]))

    def team_block(team_id: int) -> dict[str, Any]:
        t = next(t for t in snap["teams"] if t["team_id"] == team_id)
        name, abbrev = aliases[team_id]
        return {
            "team_id": team_id,
            "name": name,
            "abbrev": abbrev,
            "wins": t["wins"],
            "losses": t["losses"],
            "ties": t["ties"],
            "points_for": float(t["points_for"] or 0),
            "standing": t["standing"],
            "roster": [
                {"player_id": r["player_id"], "lineup_slot": r["lineup_slot"]}
                for r in snap["rosters"] if r["team_id"] == team_id
            ],
        }

    m = next(
        (x for x in snap["matchups"] if x["matchup_period"] == period and me in (x["home_team_id"], x["away_team_id"])),
        None,
    )
    if m is None:
        raise RuntimeError(f"No matchup found for team {me} in period {period}")
    mine_home = m["home_team_id"] == me
    opp_id = m["away_team_id"] if mine_home else m["home_team_id"]

    settings = snap["settings"]
    data = {
        "meta": {
            "schema_version": 1,
            "updated_at": snap["fetched_at"],
            "season": snap["season"],
            "scoring_type": settings["scoring_type"],
            "scoring_items": settings["scoring_items"],
            "roster_slots": settings["roster_slots"],
            "position_limits": settings["position_limits"],
            "lineup_lock": settings["lineup_lock"],
            "matchup_period": period,
            "matchup_days": [day_dates[d] for d in sorted(day_dates)],
            "scoring_period": snap["scoring_period"],
            "today": now.astimezone(espn.ET).date().isoformat(),
            "anonymized": anonymize,
            "free_agent_count": len(fa_rank),
        },
        "teams": [
            {
                "team_id": t["team_id"],
                "name": aliases[t["team_id"]][0],
                "abbrev": aliases[t["team_id"]][1],
                "wins": t["wins"],
                "losses": t["losses"],
                "ties": t["ties"],
                "points_for": float(t["points_for"] or 0),
                "standing": t["standing"],
                "is_mine": t["team_id"] == me,
            }
            for t in sorted(snap["teams"], key=lambda t: t["standing"] or 99)
        ],
        "my_team": team_block(me),
        "opponent": team_block(opp_id) if opp_id is not None else None,
        "matchup": {
            "matchup_period": period,
            "is_bye": opp_id is None,
            "my_score": m["home_score"] if mine_home else m["away_score"],
            "opponent_score": m["away_score"] if mine_home else m["home_score"],
            "projected": None,
        },
        "players": players,
    }
    recs = recommend(data)
    data["recommendations"] = recs
    data["matchup"]["projected"] = recs.get("matchup_projection")
    return data


# --- checks + write --------------------------------------------------------

def sanity_check(data: dict[str, Any]) -> None:
    """Catch partial pulls the schema can't: an empty roster, missing teams, etc."""
    problems = []
    if len(data["teams"]) < 9:
        problems.append(f"only {len(data['teams'])} teams")
    if len(data["my_team"]["roster"]) < 10:
        problems.append(f"my roster has {len(data['my_team']['roster'])} players")
    if data["opponent"] and len(data["opponent"]["roster"]) < 10:
        problems.append(f"opponent roster has {len(data['opponent']['roster'])} players")
    if data["meta"]["free_agent_count"] < 20:
        problems.append(f"only {data['meta']['free_agent_count']} free agents")
    ids = {p["id"] for p in data["players"]}
    missing = [r["player_id"] for r in data["my_team"]["roster"] if r["player_id"] not in ids]
    if missing:
        problems.append(f"{len(missing)} of my players have no player record")
    if problems:
        raise RuntimeError("Sanity check failed: " + "; ".join(problems))


def _comparable(data: dict[str, Any]) -> dict[str, Any]:
    d = json.loads(json.dumps(data))
    d["meta"].pop("updated_at", None)
    return d


def write(data: dict[str, Any], now: datetime) -> bool:
    """Write latest.json and a snapshot. Returns False (writes nothing) if nothing changed."""
    if LATEST.exists():
        try:
            if _comparable(json.loads(LATEST.read_text())) == _comparable(data):
                return False
        except (json.JSONDecodeError, KeyError):
            pass
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n"
    stamp = now.astimezone(espn.ET).strftime("%Y-%m-%d-%H%M")
    tmp = LATEST.with_suffix(".json.tmp")
    tmp.write_text(body)
    (SNAPSHOTS / f"{stamp}.json").write_text(body)
    os.replace(tmp, LATEST)
    return True


def summary(data: dict[str, Any]) -> str:
    m = data["matchup"]
    opp = data["opponent"]["name"] if data["opponent"] else "bye"
    return (
        f"Matchup {m['matchup_period']} vs {opp}: {m['my_score']}–{m['opponent_score']}. "
        f"{len(data['players'])} players ({data['meta']['free_agent_count']} free agents), "
        f"{len(data['recommendations']['lineup'])} lineup recs, {len(data['recommendations']['pickups'])} pickups. "
        f"Anonymized: {data['meta']['anonymized']}."
    )


def main() -> int:
    now = datetime.now(timezone.utc)
    try:
        if "--check" in sys.argv:
            league = espn.connect()
            print(f"ESPN reachable: {len(league.teams)} teams, matchup period {league.currentMatchupPeriod}.")
            return 0
        snap = espn.fetch_snapshot()
        data = build(snap, anonymize=env_flag("ANONYMIZE", True), now=now)
        jsonschema.validate(data, SCHEMA, format_checker=jsonschema.FormatChecker())
        sanity_check(data)
    except espn.ReconnectNeeded as e:
        gh_error(f"ESPN auth failed — cookies expired or missing. {e} Data left unchanged.")
        return 2
    except jsonschema.ValidationError as e:
        path = "/".join(str(p) for p in e.absolute_path)
        gh_error(f"Output failed schema validation at '{path}': {e.message}. Data left unchanged.")
        return 3
    except Exception as e:
        gh_error(f"{type(e).__name__}: {e}. Data left unchanged.")
        return 1

    print(summary(data))
    if "--dry-run" in sys.argv:
        print("Dry run: nothing written.")
        return 0
    print("Wrote data/latest.json and a snapshot." if write(data, now) else "No changes since the last run; nothing written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
