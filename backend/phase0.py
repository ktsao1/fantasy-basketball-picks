"""Phase 0: connect to ESPN and print what the engine needs to know.

Run from the repo root:
    .venv/bin/python backend/phase0.py
    .venv/bin/python backend/phase0.py --raw   # also print ESPN's raw roster/acquisition settings

Read-only. Prints league settings, Kevin's roster, this week's opponent and the top free agents.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime

import espn_client as espn



def heading(text: str) -> None:
    print(f"\n{'=' * 64}\n{text}\n{'=' * 64}")


def player_line(p, season: int) -> str:
    total = p.stats.get(f"{season}_total", {})
    avg = total.get("avg", {}) or {}
    gp = avg.get("GP") or total.get("total", {}).get("GP")
    cats = " ".join(
        f"{k} {avg[k]:.1f}" for k in ("PTS", "REB", "AST", "STL", "BLK", "3PM", "TO") if isinstance(avg.get(k), (int, float))
    )
    fpts = total.get("applied_avg")
    fpts_s = f" | {fpts:.1f} fpts/g" if isinstance(fpts, (int, float)) and fpts else ""
    inj = "" if p.injuryStatus in (None, "ACTIVE", "NORMAL") else f" [{p.injuryStatus}]"
    slot = f"{p.lineupSlot or '-':>5}"
    elig = "/".join(s for s in p.eligibleSlots if s not in ("BE", "IR", "UT", "G", "F", "G/F", "F/C", "PF/C", "SG/SF", "Rookie", ""))
    gp_s = f" ({int(gp)} gp)" if gp else ""
    return f"{slot}  {p.name:<26} {p.proTeam:<4} {elig:<12}{inj}{gp_s}  {cats}{fpts_s}"


def print_settings(summary: dict, show_raw: bool) -> None:
    heading(f"LEAGUE SETTINGS — {summary['name']} ({summary['teams']} teams)")
    print(f"Scoring type:        {summary['scoring_type']}")
    print("Scoring items:")
    for it in summary["scoring_items"]:
        pts = f"{it['points']:+g} pts" if it["points"] else ""
        rev = "  (lower is better)" if it["lower_is_better"] else ""
        print(f"  - {it['stat']:<6} {pts}{rev}")
    print(f"Roster slots:        {summary['roster_slots']}")
    if summary["position_limits"]:
        print(f"Position limits:     {summary['position_limits']}")
    print(f"Lineup lock:         {summary['lineup_lock']}")
    print(f"Move limit:          {summary['move_limit']}")
    print(f"Matchup periods:     {summary['matchup_periods']} (length {summary['matchup_period_length']}), playoffs {summary['playoff_teams']} teams")
    print(f"Acquisition limit:   season {summary['acquisition_limit']}, per matchup {summary['matchup_acquisition_limit']}"
          f" (per scoring period: {summary['matchup_limit_per_scoring_period']})")
    print(f"FAAB:                {summary['faab']} (budget {summary['faab_budget']})")
    print(f"Waivers:             {summary['waiver_hours']}h, process days {summary['waiver_process_days']}, order reset {summary['waiver_order_reset']}")
    if summary["trade_deadline"]:
        print(f"Trade deadline:      {datetime.fromtimestamp(summary['trade_deadline'] / 1000):%Y-%m-%d}")
    if show_raw:
        print("\nRaw settings:")
        print(json.dumps(summary["_raw"], indent=2, default=str))


def print_roster(team, season: int, label: str) -> None:
    heading(f"{label}: {team.team_name} ({team.wins}-{team.losses}-{team.ties})")
    for p in sorted(team.roster, key=lambda p: (p.lineupSlot in ("BE", "IR"), p.lineupSlot == "IR")):
        print(player_line(p, season))


def main() -> int:
    show_raw = "--raw" in sys.argv
    try:
        cfg = espn.load_config()
        league = espn.connect(cfg)
        summary = espn.summarize_settings(league)
    except espn.ReconnectNeeded as e:
        print(f"\n⚠️  {e}\n", file=sys.stderr)
        return 2

    print(f"Connected: league {cfg.league_id}, season {cfg.season}, "
          f"matchup period {league.currentMatchupPeriod}, scoring period {league.scoringPeriodId}")
    print_settings(summary, show_raw)

    me = espn.my_team(league, cfg.team_id)
    print_roster(me, cfg.season, "MY ROSTER")

    box = espn.current_matchup(league, cfg.team_id)
    if box is None:
        print("\nNo current matchup found (preseason or bye).")
    else:
        mine_home = getattr(box.home_team, "team_id", None) == cfg.team_id
        opp = box.away_team if mine_home else box.home_team
        if hasattr(opp, "roster"):
            print_roster(opp, cfg.season, f"OPPONENT (matchup period {league.currentMatchupPeriod})")
        if hasattr(box, "home_stats"):
            mine = box.home_stats if mine_home else box.away_stats
            theirs = box.away_stats if mine_home else box.home_stats
            heading("MATCHUP SO FAR (categories)")
            for cat in mine:
                print(f"  {cat:<6} me {mine[cat]['value']:>8.3f}   them {theirs.get(cat, {}).get('value', 0):>8.3f}   {mine[cat]['result']}")
        elif hasattr(box, "home_score"):
            heading("MATCHUP SO FAR (points)")
            my_s, op_s = (box.home_score, box.away_score) if mine_home else (box.away_score, box.home_score)
            my_p, op_p = (box.home_projected, box.away_projected) if mine_home else (box.away_projected, box.home_projected)
            print(f"  me {my_s} (proj {my_p})   them {op_s} (proj {op_p})")

    heading("TOP 25 FREE AGENTS (by % owned)")
    for p in espn.free_agents(league, size=25):
        print(player_line(p, cfg.season))

    print("\nOther teams:")
    for t in league.teams:
        if t.team_id != cfg.team_id:
            print(f"  {t.team_id:>3}  {t.team_name:<30} {t.wins}-{t.losses}-{t.ties}  ({len(t.roster)} players)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
