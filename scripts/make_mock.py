"""Generate a mock data/snapshot.json (and previous.json) in fetch_league.py's exact shape."""
import json, random, sys
from datetime import datetime, timedelta
from pathlib import Path

random.seed(27)
OUT = Path(sys.argv[1])

# team -> day offsets (0 = Wed 11/18) with a game in the next 7 days
SCHED = {
    "BOS": [0, 2, 4, 6], "NYK": [0, 2, 3, 5], "MIL": [1, 3, 5], "DEN": [0, 1, 3, 5],
    "OKC": [1, 3, 4, 6], "LAL": [0, 3, 5], "GSW": [1, 4], "PHX": [0, 2, 5],
    "SAC": [1, 2, 4, 6], "MIN": [0, 2, 4], "IND": [1, 3, 6], "ORL": [0, 2, 4, 5],
    "HOU": [1, 3, 5], "MEM": [0, 3, 6], "CLE": [1, 2, 4, 6], "ATL": [0, 2, 5],
    "CHA": [1, 4, 6], "SAS": [0, 2, 3, 5], "TOR": [1, 3], "POR": [0, 2, 4, 6],
    "UTA": [1, 4], "DET": [0, 2, 4, 5], "CHI": [1, 3, 5], "MIA": [0, 3, 5],
    "BKN": [1, 2, 4], "NOP": [0, 3, 5], "LAC": [1, 3, 6], "DAL": [0, 2, 4],
    "WAS": [1, 3, 5, 6], "PHI": [0, 2, 5],
}

# name, pos, eligible, team, slot (None for FAs), season line (pts reb ast stl blk 3pm fg% ft% to min),
# last-7 trend multiplier, injury status, expected return
ROSTER = [
    ("Tyrese Haliburton", "PG", ["PG", "G"], "IND", "PG", (19.8, 3.9, 9.6, 1.3, 0.6, 2.9, .468, .851, 2.4, 33.5), 1.05, "ACTIVE", None),
    ("Desmond Bane", "SG", ["SG", "SF", "G", "F"], "ORL", "SG", (18.9, 4.6, 4.4, 1.1, 0.4, 2.6, .478, .892, 2.2, 32.8), 1.12, "ACTIVE", None),
    ("Mikal Bridges", "SF", ["SG", "SF", "G", "F"], "NYK", "SF", (17.6, 3.5, 3.4, 1.0, 0.4, 2.1, .494, .812, 1.6, 36.2), 0.86, "ACTIVE", None),
    ("Jaren Jackson Jr.", "PF", ["PF", "C", "F"], "MEM", "PF", (21.4, 5.8, 1.9, 1.1, 1.8, 1.9, .487, .796, 2.1, 30.4), 0.93, "DAY_TO_DAY", None),
    ("Alperen Sengun", "C", ["C"], "HOU", "C", (20.1, 10.4, 5.2, 1.2, 1.0, 0.4, .508, .701, 3.1, 32.9), 1.08, "ACTIVE", None),
    ("Jalen Williams", "SG", ["SG", "SF", "G", "F"], "OKC", "G", (20.7, 5.4, 5.1, 1.5, 0.6, 1.8, .489, .811, 2.4, 33.0), 1.02, "ACTIVE", None),
    ("Scottie Barnes", "SF", ["SF", "PF", "F"], "TOR", "F", (19.2, 7.9, 6.0, 1.4, 1.0, 1.3, .471, .765, 2.6, 34.8), 0.95, "ACTIVE", None),
    ("Derrick White", "PG", ["PG", "SG", "G"], "BOS", "UT", (16.4, 4.4, 4.9, 1.0, 1.2, 3.2, .452, .884, 1.5, 33.1), 1.15, "ACTIVE", None),
    ("Jarrett Allen", "C", ["C"], "CLE", "UT", (13.8, 10.2, 1.8, 0.8, 1.1, 0.0, .684, .688, 1.2, 29.0), 1.00, "ACTIVE", None),
    ("Dejounte Murray", "PG", ["PG", "SG", "G"], "NOP", "UT", (17.0, 5.1, 6.4, 1.4, 0.3, 1.9, .439, .790, 2.5, 31.2), 0.74, "ACTIVE", None),
    ("Jalen Suggs", "SG", ["PG", "SG", "G"], "ORL", "BE", (13.4, 3.8, 3.9, 1.6, 0.6, 2.0, .418, .790, 2.0, 27.7), 0.97, "ACTIVE", None),
    ("Keegan Murray", "PF", ["SF", "PF", "F"], "SAC", "BE", (14.1, 6.6, 1.6, 0.9, 0.7, 2.2, .455, .810, 0.9, 32.5), 0.80, "ACTIVE", None),
    ("Domantas Sabonis", "C", ["PF", "C", "F"], "SAC", "IR", (19.1, 13.4, 6.2, 0.8, 0.4, 0.5, .590, .748, 3.2, 34.6), 1.00, "OUT", "2026-12-02"),
]

FREE_AGENTS = [
    ("Naz Reid", "C", ["PF", "C", "F"], "MIN", (14.2, 6.4, 2.0, 1.0, 1.0, 2.0, .468, .812, 1.3, 25.1), 1.25, "ACTIVE", None),
    ("Ausar Thompson", "SF", ["SG", "SF", "G", "F"], "DET", (11.6, 7.2, 2.6, 1.8, 1.2, 0.3, .512, .640, 1.5, 27.8), 1.22, "ACTIVE", None),
    ("Keyonte George", "PG", ["PG", "SG", "G"], "UTA", (16.8, 3.9, 5.6, 0.8, 0.2, 2.6, .412, .845, 2.6, 30.6), 1.10, "ACTIVE", None),
    ("Bennedict Mathurin", "SG", ["SG", "SF", "G", "F"], "IND", (16.1, 5.3, 1.9, 0.6, 0.2, 1.4, .446, .818, 1.9, 28.2), 0.92, "ACTIVE", None),
    ("Walker Kessler", "C", ["C"], "UTA", (10.9, 10.8, 1.5, 0.6, 2.4, 0.0, .660, .560, 1.0, 26.4), 1.04, "ACTIVE", None),
    ("Toumani Camara", "SF", ["SF", "PF", "F"], "POR", (11.8, 5.6, 2.2, 1.5, 0.6, 1.9, .452, .760, 1.1, 30.0), 1.18, "ACTIVE", None),
    ("Jaden Ivey", "SG", ["PG", "SG", "G"], "DET", (15.4, 3.9, 4.2, 0.9, 0.5, 1.8, .448, .760, 2.3, 28.0), 1.06, "DAY_TO_DAY", None),
    ("Isaiah Stewart", "C", ["PF", "C", "F"], "DET", (9.4, 7.2, 1.4, 0.6, 1.5, 0.8, .520, .710, 0.9, 23.5), 1.15, "ACTIVE", None),
    ("Nickeil Alexander-Walker", "SG", ["PG", "SG", "SF", "G", "F"], "ATL", (12.1, 3.0, 3.1, 1.1, 0.5, 2.3, .448, .812, 1.2, 26.3), 1.20, "ACTIVE", None),
    ("Onyeka Okongwu", "C", ["PF", "C", "F"], "ATL", (12.8, 8.6, 2.1, 0.9, 1.0, 0.6, .560, .770, 1.1, 27.6), 0.95, "ACTIVE", None),
    ("Deni Avdija", "SF", ["SF", "PF", "F"], "POR", (16.2, 7.4, 4.0, 0.9, 0.4, 1.4, .478, .790, 2.4, 31.0), 1.02, "ACTIVE", None),
    ("Tari Eason", "PF", ["SF", "PF", "F"], "HOU", (11.0, 6.3, 1.3, 1.6, 0.9, 1.1, .471, .700, 1.0, 23.9), 1.12, "ACTIVE", None),
    ("Cason Wallace", "PG", ["PG", "SG", "G"], "OKC", (8.8, 3.1, 2.3, 1.6, 0.4, 1.3, .468, .810, 0.9, 24.2), 1.30, "ACTIVE", None),
    ("Zach Edey", "C", ["C"], "MEM", (10.8, 9.6, 1.0, 0.4, 1.4, 0.0, .600, .660, 1.3, 23.8), 0.0, "OUT", "2026-12-10"),
    ("Collin Sexton", "SG", ["PG", "SG", "G"], "CHA", (15.6, 2.6, 3.8, 0.8, 0.1, 1.8, .478, .862, 2.0, 27.0), 0.97, "ACTIVE", None),
    ("Kelly Oubre Jr.", "SF", ["SG", "SF", "G", "F"], "PHI", (14.4, 5.2, 1.5, 1.2, 0.6, 1.6, .450, .760, 1.3, 30.1), 0.88, "ACTIVE", None),
    ("Nick Richards", "C", ["C"], "PHX", (8.9, 8.2, 0.8, 0.4, 1.0, 0.0, .610, .700, 1.1, 22.0), 0.90, "ACTIVE", None),
    ("Aaron Nesmith", "SF", ["SG", "SF", "G", "F"], "IND", (11.5, 3.8, 1.3, 0.8, 0.6, 2.1, .470, .840, 0.8, 26.0), 1.05, "ACTIVE", None),
    ("Jonathan Kuminga", "PF", ["SF", "PF", "F"], "GSW", (15.0, 5.2, 2.2, 0.8, 0.5, 0.9, .470, .680, 1.7, 25.5), 0.82, "ACTIVE", None),
    ("Grayson Allen", "SG", ["SG", "SF", "G", "F"], "PHX", (11.2, 3.4, 2.4, 0.9, 0.3, 2.6, .450, .860, 1.0, 25.8), 1.08, "ACTIVE", None),
    ("Moussa Diabaté", "C", ["C"], "CHA", (7.8, 8.9, 1.2, 0.9, 1.0, 0.0, .610, .620, 0.8, 22.6), 1.20, "ACTIVE", None),
    ("Bilal Coulibaly", "SF", ["SG", "SF", "G", "F"], "WAS", (12.4, 5.0, 2.9, 1.4, 0.7, 1.1, .440, .730, 1.6, 30.4), 1.10, "ACTIVE", None),
    ("Kris Dunn", "PG", ["PG", "SG", "G"], "LAC", (6.1, 3.6, 3.2, 1.6, 0.5, 0.7, .470, .600, 0.9, 22.5), 1.00, "ACTIVE", None),
    ("Dyson Daniels", "SG", ["PG", "SG", "SF", "G", "F"], "ATL", (13.5, 5.6, 4.2, 2.8, 0.7, 1.0, .460, .600, 2.1, 32.6), 0.98, "DAY_TO_DAY", None),
    ("Mark Williams", "C", ["C"], "PHX", (12.2, 9.1, 1.1, 0.6, 1.2, 0.0, .600, .720, 1.4, 25.4), 1.00, "ACTIVE", None),
    ("Ty Jerome", "PG", ["PG", "SG", "G"], "MEM", (12.6, 2.8, 3.8, 1.0, 0.2, 1.6, .480, .880, 1.4, 21.0), 1.14, "ACTIVE", None),
    ("Jabari Smith Jr.", "PF", ["PF", "C", "F"], "HOU", (13.0, 7.4, 1.3, 0.6, 0.8, 1.9, .455, .820, 0.9, 30.2), 0.96, "ACTIVE", None),
    ("Kevin Huerter", "SG", ["SG", "SF", "G", "F"], "CHI", (10.6, 3.2, 2.6, 0.7, 0.3, 2.2, .430, .800, 1.0, 24.5), 0.85, "ACTIVE", None),
    ("Peyton Watson", "SF", ["SF", "PF", "F"], "DEN", (9.8, 4.4, 1.6, 0.8, 1.3, 1.0, .470, .720, 0.9, 24.8), 1.16, "ACTIVE", None),
    ("Royce O'Neale", "PF", ["SF", "PF", "F"], "PHX", (8.4, 5.0, 2.4, 1.0, 0.4, 2.0, .410, .780, 0.9, 25.4), 0.90, "ACTIVE", None),
    ("Gradey Dick", "SG", ["SG", "SF", "G", "F"], "TOR", (13.6, 3.3, 1.8, 0.8, 0.3, 2.3, .430, .860, 1.1, 28.4), 0.79, "ACTIVE", None),
    ("Daniel Gafford", "C", ["C"], "DAL", (11.6, 7.0, 1.2, 0.6, 1.8, 0.0, .700, .650, 0.8, 21.8), 1.07, "DAY_TO_DAY", None),
    ("Andrew Nembhard", "PG", ["PG", "SG", "G"], "IND", (11.8, 3.2, 5.0, 1.1, 0.2, 1.1, .470, .820, 1.5, 28.8), 1.03, "ACTIVE", None),
    ("Obi Toppin", "PF", ["PF", "F"], "IND", (10.2, 4.0, 1.4, 0.5, 0.5, 1.2, .540, .740, 0.7, 19.6), 0.92, "ACTIVE", None),
    ("Caris LeVert", "SG", ["SG", "SF", "G", "F"], "ATL", (10.4, 3.3, 3.6, 0.8, 0.3, 1.4, .430, .810, 1.3, 22.4), 0.88, "ACTIVE", None),
    ("Jusuf Nurkic", "C", ["C"], "CHA", (9.5, 8.8, 2.9, 0.6, 0.8, 0.3, .480, .680, 2.0, 22.0), 0.94, "ACTIVE", None),
    ("Tre Mann", "PG", ["PG", "SG", "G"], "CHA", (13.2, 3.1, 3.4, 0.7, 0.2, 2.0, .420, .860, 1.5, 24.6), 1.12, "ACTIVE", None),
    ("Rui Hachimura", "PF", ["SF", "PF", "F"], "LAL", (12.8, 5.0, 1.2, 0.6, 0.3, 1.2, .500, .760, 0.8, 27.6), 1.00, "ACTIVE", None),
    ("Santi Aldama", "PF", ["PF", "C", "F"], "MEM", (10.8, 6.4, 2.6, 0.7, 0.8, 1.5, .460, .740, 1.0, 23.6), 1.24, "ACTIVE", None),
    ("Jeremy Sochan", "PF", ["SF", "PF", "F"], "SAS", (10.2, 6.6, 3.0, 0.9, 0.4, 0.5, .470, .700, 1.6, 26.8), 0.91, "ACTIVE", None),
]

CATS = ["PTS", "REB", "AST", "STL", "BLK", "3PM", "FG%", "FT%", "TO", "MIN"]


def cats(line, mult):
    out = {}
    for k, v in zip(CATS, line):
        if k in ("FG%", "FT%"):
            out[k] = round(min(v * (1 + (mult - 1) * 0.15), 0.95), 3)
        elif k == "MIN":
            out[k] = round(v * (1 + (mult - 1) * 0.4), 1)
        else:
            out[k] = round(v * mult * random.uniform(0.95, 1.05), 1)
    return out


def fpts(c):  # ESPN default points-league weights, for applied_avg
    return round(c["PTS"] + c["REB"] + 2 * c["AST"] + 4 * c["STL"] + 4 * c["BLK"] + c["3PM"] - 2 * c["TO"], 1)


def block(c):
    return {"fpts_avg": fpts(c), "cats": c}


def player(pid, name, pos, elig, team, slot, line, trend, inj, ret, owner, start):
    l7 = cats(line, trend) if trend else None
    windows = {
        "season": cats(line, 1.0),
        "last_7": l7,
        "last_15": cats(line, 1 + (trend - 1) * 0.6) if trend else cats(line, 1.0),
        "last_30": cats(line, 1 + (trend - 1) * 0.3) if trend else cats(line, 1.0),
        "projected": cats(line, 1 + (trend - 1) * 0.25) if trend else cats(line, 1.0),
    }
    form = {k: (block(v) if v else {"fpts_avg": None, "cats": None}) for k, v in windows.items()}
    games = [(start + timedelta(days=d)).strftime("%a %m/%d") for d in SCHED[team]]
    return {
        "id": pid, "name": name, "position": pos, "eligible": elig, "pro_team": team,
        "owner": owner, "lineup_slot": slot,
        "injury": {"status": inj, "expected_return": ret},
        "games_next_7": games, "form": form,
    }


def build(start, generated_at, record, overrides=None):
    random.seed(27)
    overrides = overrides or {}
    players = []
    pid = 4_000_100
    for r in ROSTER:
        r = overrides.get(r[0], r)
        players.append(player(pid, *r[:5], *r[5:], owner="me", start=start)); pid += 7
    pid = 4_200_300
    for f in FREE_AGENTS:
        f = overrides.get(f[0], f)
        name, pos, elig, team, line, trend, inj, ret = f
        players.append(player(pid, name, pos, elig, team, None, line, trend, inj, ret, owner="free_agent", start=start)); pid += 11
    return {
        "_mock": True,
        "generated_at": generated_at,
        "league": {"name": "Hardwood Nine", "scoring_type": "H2H_CATEGORY", "teams": 9, "matchup_period": 5},
        "my_team": {"name": "War Room", "record": record},
        "players": players,
    }


cur = build(datetime(2026, 11, 18), "2026-11-18T08:30", "3-1-0")
# yesterday: Jaren Jackson was ACTIVE, Naz Reid hadn't heated up yet, Murray was still producing
prev_over = {
    "Jaren Jackson Jr.": ("Jaren Jackson Jr.", "PF", ["PF", "C", "F"], "MEM", "PF", (21.4, 5.8, 1.9, 1.1, 1.8, 1.9, .487, .796, 2.1, 30.4), 1.02, "ACTIVE", None),
    "Naz Reid": ("Naz Reid", "C", ["PF", "C", "F"], "MIN", (14.2, 6.4, 2.0, 1.0, 1.0, 2.0, .468, .812, 1.3, 25.1), 1.05, "ACTIVE", None),
    "Dejounte Murray": ("Dejounte Murray", "PG", ["PG", "SG", "G"], "NOP", "UT", (17.0, 5.1, 6.4, 1.4, 0.3, 1.9, .439, .790, 2.5, 31.2), 0.95, "ACTIVE", None),
}
prev = build(datetime(2026, 11, 17), "2026-11-17T08:30", "3-1-0", prev_over)

OUT.mkdir(exist_ok=True)
(OUT / "snapshot.json").write_text(json.dumps(cur, indent=2))
(OUT / "previous.json").write_text(json.dumps(prev, indent=2))
print(len(cur["players"]), "players")
