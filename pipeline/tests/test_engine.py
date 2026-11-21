"""Engine checks that run before every data build (python -m unittest discover -s tests)."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine import recommend
from engine.lineup import best_day, solve


def player(pid, name, value, positions, dates=("2026-11-21",), status="ACTIVE", owner=14, gp=15, locked=False):
    line = {"fpts_avg": value, "fpts_total": value * gp, "gp": gp, "mpg": 30.0, "avg": {}}
    return {
        "id": pid, "name": name, "nba_team": f"T{pid}", "primary_position": positions[0],
        "positions": list(positions) + ["UT"], "injury_status": status, "expected_return": None,
        "owner": owner, "free_agent_rank": None if owner else pid, "free_agent_status": None if owner else "FREEAGENT",
        "stats": {"season": line, "last_7": line, "last_15": line, "last_30": line},
        "projection": {"espn": line, "engine_fpts_per_game": None},
        "games_left_this_week": len(dates), "game_dates_left": list(dates), "back_to_back_dates": [],
        "game_today_locked": locked, "games_left_season": 60,
    }


def league(players, roster, today="2026-11-21"):
    return {
        "meta": {"today": today, "adds_effective_date": today, "roster_slots": {"PG": 1, "C": 1, "UT": 1, "BE": 3},
                 "regular_season_weeks": 19, "matchup_period": 5},
        "my_team": {"roster": roster}, "opponent": None,
        "matchup": {"my_score": 0, "opponent_score": None}, "players": players,
    }


class SolverTests(unittest.TestCase):
    def test_beats_greedy(self):
        # Greedy would put the 50-pt C/UT player at C and leave the C-only player out.
        total, picks = solve([(1, 50, ["C", "UT"], None), (2, 40, ["C"], None)], ["C", "UT"])
        self.assertEqual(total, 90)
        self.assertEqual(picks, {0: 2, 1: 1})

    def test_keeps_current_slot_on_ties(self):
        _, picks = solve([(1, 30, ["PG", "UT"], "UT"), (2, 30, ["PG", "UT"], "PG")], ["PG", "UT"])
        self.assertEqual(picks, {0: 2, 1: 1})

    def test_locked_player_holds_slot_today(self):
        ps = {1: player(1, "Locked", 10, ["PG"], locked=True), 2: player(2, "Better", 40, ["PG"])}
        roster = [{"player_id": 1, "lineup_slot": "PG"}, {"player_id": 2, "lineup_slot": "BE"}]
        day = best_day("2026-11-21", roster, ps, lambda p, d: p["stats"]["season"]["fpts_avg"], ["PG", "UT"], True)
        self.assertEqual(day.assignment["PG"], 1)
        self.assertEqual(day.assignment["UT"], 2)


class RecommendTests(unittest.TestCase):
    def test_starts_bench_player_over_injured_starter(self):
        ps = [player(1, "Hurt", 45, ["PG"], status="OUT"), player(2, "Healthy", 30, ["PG"]),
              player(3, "Big", 30, ["C"])]
        roster = [{"player_id": 1, "lineup_slot": "PG"}, {"player_id": 2, "lineup_slot": "BE"},
                  {"player_id": 3, "lineup_slot": "C"}]
        recs = recommend(league(ps, roster))
        actions = {(c["action"], c["player_id"]) for c in recs["changes"]}
        self.assertIn(("bench", 1), actions)
        self.assertTrue(("start", 2) in actions)
        for item in recs["lineup"] + recs["changes"] + recs["pickups"]:
            self.assertTrue(item["reason"])
            self.assertIn(item["confidence"]["level"], ("high", "medium", "low"))

    def test_never_drops_a_better_player(self):
        ps = [player(1, "Star", 45, ["PG"], status="OUT"), player(2, "Mid", 30, ["C"]),
              player(3, "Weak", 15, ["PG"]), player(9, "FreeAgent", 25, ["PG"], owner=None)]
        roster = [{"player_id": 1, "lineup_slot": "PG"}, {"player_id": 2, "lineup_slot": "C"},
                  {"player_id": 3, "lineup_slot": "UT"}]
        recs = recommend(league(ps, roster))
        drops = {p["drop_player_id"] for p in recs["pickups"]}
        self.assertNotIn(1, drops)
        self.assertEqual(drops, {3})

    def test_scores_qualifying_pickups_across_the_tracked_pool(self):
        roster = [{"player_id": 1, "lineup_slot": "PG"}]
        players = [player(1, "Starter", 10, ["PG"])]
        players += [player(pid, f"Free agent {pid}", pid, ["PG"], owner=None) for pid in range(11, 46)]
        players.append(player(46, "Unavailable", 50, ["PG"], owner=None, status="OUT"))
        pickups = recommend(league(players, roster))["pickups"]
        self.assertEqual([pick["add_player_id"] for pick in pickups], list(range(45, 10, -1)))
        self.assertTrue(all(pick["drop_player_id"] == 1 for pick in pickups))


class ExplanationTests(unittest.TestCase):
    """Factors, ranges and win probability: the structured reasons the dashboard draws."""

    def test_swap_factors_add_up_to_the_gain(self):
        two = ("2026-11-21", "2026-11-22")
        ps = [player(1, "Starter", 40, ["PG"], dates=two), player(2, "Big", 35, ["C"], dates=two),
              player(3, "Weak", 15, ["PG"]), player(9, "FreeAgent", 25, ["PG"], dates=two, owner=None)]
        roster = [{"player_id": 1, "lineup_slot": "PG"}, {"player_id": 2, "lineup_slot": "C"},
                  {"player_id": 3, "lineup_slot": "UT"}]
        pick = recommend(league(ps, roster))["pickups"][0]
        keys = [f["key"] for f in pick["factors"]]
        self.assertEqual(keys[0], "schedule")              # 2 games vs 1 outweighs +10 fpts/g
        drivers = [f["impact_fpts"] for f in pick["factors"] if f["impact_fpts"] is not None]
        self.assertEqual(drivers, sorted(drivers, key=abs, reverse=True))
        self.assertAlmostEqual(sum(drivers), pick["gain_this_week"], delta=1.0)
        low, high = pick["gain_this_week_range"]
        self.assertLess(low, pick["gain_this_week"])
        self.assertGreater(high, pick["gain_this_week"])

    def test_every_recommendation_has_factors(self):
        ps = [player(1, "Hurt", 45, ["PG"], status="OUT"), player(2, "Healthy", 30, ["PG"]),
              player(3, "Big", 30, ["C"])]
        roster = [{"player_id": 1, "lineup_slot": "PG"}, {"player_id": 2, "lineup_slot": "BE"},
                  {"player_id": 3, "lineup_slot": "C"}]
        recs = recommend(league(ps, roster))
        start = next(c for c in recs["changes"] if c["action"] == "start")
        self.assertEqual(start["factors"][0]["key"], "projection")
        self.assertAlmostEqual(start["factors"][0]["impact_fpts"], 30.0)
        self.assertIn("availability", [f["key"] for f in start["factors"]])
        for item in recs["lineup"] + recs["changes"] + recs["pickups"]:
            self.assertIn("factors", item)

    def test_win_probability_follows_the_projection(self):
        mine = [player(1, "A", 40, ["PG"]), player(2, "B", 40, ["C"])]
        theirs = [player(5, "X", 20, ["PG"], owner=3), player(6, "Y", 20, ["C"], owner=3)]
        data = league(mine + theirs, [{"player_id": 1, "lineup_slot": "PG"}, {"player_id": 2, "lineup_slot": "C"}])
        data["opponent"] = {"roster": [{"player_id": 5, "lineup_slot": "PG"}, {"player_id": 6, "lineup_slot": "C"}]}
        data["matchup"]["opponent_score"] = 0
        proj = recommend(data)["matchup_projection"]
        self.assertGreater(proj["win_probability"], 0.5)
        self.assertLess(proj["mine_range"][0], proj["mine"])
        self.assertGreater(proj["opponent_range"][1], proj["opponent"])


if __name__ == "__main__":
    unittest.main()


class DailyViewTests(unittest.TestCase):
    """Per-day output the Today and Matchup pages step through (engine 1.2)."""

    def test_changes_for_a_later_day(self):
        # Starter plays day 1 only; the bench player plays day 2 only, so day 2 needs a swap.
        ps = [player(1, "DayOne", 40, ["PG"], dates=("2026-11-21",)),
              player(2, "DayTwo", 30, ["PG"], dates=("2026-11-22",)), player(3, "Big", 30, ["C"])]
        roster = [{"player_id": 1, "lineup_slot": "PG"}, {"player_id": 2, "lineup_slot": "BE"},
                  {"player_id": 3, "lineup_slot": "C"}]
        recs = recommend(league(ps, roster))
        self.assertEqual(recs["changes"], recs["changes_by_day"]["2026-11-21"])
        later = {(c["action"], c["player_id"]) for c in recs["changes_by_day"]["2026-11-22"]}
        self.assertIn(("start", 2), later)

    def test_opponent_lineup_per_day(self):
        mine = [player(1, "A", 40, ["PG"]), player(2, "B", 40, ["C"])]
        theirs = [player(5, "X", 20, ["PG"], owner=3), player(6, "Y", 25, ["C"], owner=3)]
        data = league(mine + theirs, [{"player_id": 1, "lineup_slot": "PG"}, {"player_id": 2, "lineup_slot": "C"}])
        data["opponent"] = {"roster": [{"player_id": 5, "lineup_slot": "PG"}, {"player_id": 6, "lineup_slot": "C"}]}
        data["matchup"]["opponent_score"] = 0
        opp = recommend(data)["opponent_lineup"]
        starters = {e["player_id"]: e["projected_fpts"] for e in opp if e["player_id"] is not None}
        self.assertEqual(starters, {5: 20.0, 6: 25.0})
        self.assertTrue(all(e["date"] == "2026-11-21" for e in opp))
