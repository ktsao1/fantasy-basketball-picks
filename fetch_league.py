"""
War Room data pull: ESPN fantasy basketball -> data/snapshot.json

Setup:
  pip install espn_api
  Set these environment variables (or put them in a .env file and export it):
    ESPN_LEAGUE_ID   - number in your league URL (?leagueId=...)
    ESPN_TEAM_ID     - number in your team URL (&teamId=...)
    ESPN_S2, ESPN_SWID - only for private leagues. Find them in Chrome DevTools >
                       Application > Cookies > fantasy.espn.com (copy "espn_s2" and "SWID").
                       Never commit these to a public repo.
Run:
  python fetch_league.py            # writes data/snapshot.json
  python fetch_league.py --debug    # prints raw ESPN requests if something looks off
"""

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

from espn_api.basketball import League
from espn_api.basketball.constant import PRO_TEAM_MAP

SEASON = 2027          # ESPN labels the 2026-27 season by its ending year
LOOKAHEAD_DAYS = 7     # window used for "games this week"
FREE_AGENT_POOL = 40   # how many free agents to pull (sorted by % owned)

TEAM_ID_BY_ABBREV = {abbrev: tid for tid, abbrev in PRO_TEAM_MAP.items()}


def games_in_window(league, pro_team_abbrev, start, end):
    """Dates of a pro team's games between start and end (from ESPN's pro schedule)."""
    tid = TEAM_ID_BY_ABBREV.get(pro_team_abbrev)
    dates = []
    for games in league.pro_schedule.get(tid, {}).values():
        for g in games:
            d = datetime.fromtimestamp(g["date"] / 1000.0)
            if start <= d < end:
                dates.append(d.strftime("%a %m/%d"))
    return sorted(set(dates))


def stat_block(player, key):
    s = player.stats.get(f"{SEASON}_{key}", {})
    return {"fpts_avg": s.get("applied_avg"), "cats": s.get("avg")}


def player_object(league, p, start, end, owner):
    return {
        "id": p.playerId,
        "name": p.name,
        "position": p.position,
        "eligible": [s for s in p.eligibleSlots if s not in ("BE", "IR", "UT")],
        "pro_team": p.proTeam,
        "owner": owner,                      # "me" | "free_agent"
        "lineup_slot": p.lineupSlot or None,
        "injury": {
            "status": p.injuryStatus,         # ACTIVE, DAY_TO_DAY, OUT, ...
            "expected_return": str(p.expected_return_date) if p.expected_return_date else None,
        },
        "games_next_7": games_in_window(league, p.proTeam, start, end),
        "form": {
            "season": stat_block(p, "total"),
            "last_7": stat_block(p, "last_7"),
            "last_15": stat_block(p, "last_15"),
            "last_30": stat_block(p, "last_30"),
            "projected": stat_block(p, "projected"),
        },
    }


def main():
    debug = "--debug" in sys.argv
    league = League(
        league_id=int(os.environ["ESPN_LEAGUE_ID"]),
        year=SEASON,
        espn_s2=os.environ.get("ESPN_S2"),
        swid=os.environ.get("ESPN_SWID"),
        debug=debug,
    )
    my_team_id = int(os.environ["ESPN_TEAM_ID"])
    me = next(t for t in league.teams if t.team_id == my_team_id)

    start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=LOOKAHEAD_DAYS)

    snapshot = {
        "generated_at": datetime.now().isoformat(timespec="minutes"),
        "league": {
            "name": league.settings.name,
            "scoring_type": league.settings.scoring_type,   # tells you points vs. categories
            "teams": len(league.teams),
            "matchup_period": league.currentMatchupPeriod,
        },
        "my_team": {"name": me.team_name, "record": f"{me.wins}-{me.losses}-{me.ties}"},
        "players": (
            [player_object(league, p, start, end, "me") for p in me.roster]
            + [player_object(league, p, start, end, "free_agent")
               for p in league.free_agents(size=FREE_AGENT_POOL)]
        ),
    }

    out = Path("data/snapshot.json")
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(snapshot, indent=2, default=str))
    print(f"Wrote {out}: {len(me.roster)} roster players, "
          f"{len(snapshot['players']) - len(me.roster)} free agents "
          f"({league.settings.scoring_type})")


if __name__ == "__main__":
    main()
