# Fantasy Basketball Tool: Build Plan

## Context for Claude Code

The user is Kevin, a designer and AI engineer. He plays in a 9-team ESPN fantasy basketball league (2026-27 season).

He wants a personal tool that reads live data from his ESPN league (his roster, his opponents' rosters, free agents). It should recommend which players to start or sit and which free agents to pick up, based on recent performance, matchups and schedule.

This file is the agreed plan. Follow it phase by phase, and **start with Phase 0** unless Kevin says otherwise.

### Decisions already made (don't revisit unless asked)

- **Recommend-only.** The tool never writes to ESPN: no lineup changes, adds, drops or trades. Kevin makes all moves himself on ESPN.
  - Why: ESPN has no supported write API, dropped players can't be recovered, and automated writes risk his account.
  - A one-click "apply lineup" may come much later as a separate decision. Don't build it now.
- **Single league only.** It's scoped to Kevin's own league.
  - Don't build accounts, sign-in, multi-league support or a Chrome extension.
  - Still keep all ESPN calls in one module (`espn_client.py`) so other leagues or a Yahoo adapter could be added later.
- **Local first.** It runs on Kevin's laptop. Hosting comes later, if at all.
- **Web dashboard** is the main interface. Kevin will design the UI in Figma before building the frontend.

### League details

| | |
|---|---|
| **League URL** | https://fantasy.espn.com/basketball/team?leagueId=1851873571&teamId=14&seasonId=2027 |
| **League ID** | `1851873571` |
| **Kevin's team ID** | `14` |
| **Season** | `2027` (ESPN labels the 2026-27 season as 2027; pass `year=2027` to the API) |
| **Teams** | 9 |
| **Privacy** | Assumed private, so authentication cookies are required |

### League settings (answered in Phase 0, 2026-11-20)

Pulled from ESPN's `mSettings` view by `backend/phase0.py`.

- **Scoring format:** **H2H points** (`H2H_POINTS`). The engine uses the points branch; z-scores per category aren't needed.
- **Point values:**

  | Stat | Pts | | Stat | Pts |
  |---|---|---|---|---|
  | PTS | +1 | | FGM | +2 |
  | REB | +1 | | FGA | −1 |
  | AST | +2 | | FTM | +1 |
  | STL | +4 | | FTA | −1 |
  | BLK | +4 | | TO | −2 |
  | 3PM | +1 | | | |

- **Roster slots:** PG, SG, SF, PF, C, G, F, 3× UT (10 starters), 3 bench, 1 IR.
  - **Position limit:** at most 4 centers on the roster. No other limits.
- **Lineup lock:** per player at his game's tip-off (`INDIVIDUAL_GAME`), so lineups are decided **daily**. Adds/drops lock at the day's first game (`FIRSTGAME_SCORINGPERIOD`).
- **Matchups:** 19 regular-season matchup periods of one week each, 4-team playoffs. Trade deadline 2027-02-26.
- **Acquisitions:** no season limit and no move limit, but **1 add per day** (matchup limit 1, applied per scoring period).
- **Waivers:** traditional (no FAAB), 24-hour waivers, processed Sundays, order doesn't reset.
- **Projections:** ESPN returns no matchup projection (`-1`) for this league, so the engine computes its own.

### ESPN access

- **Library:** `espn-api` (https://github.com/cwendt94/espn-api), basketball module:

  ```python
  from espn_api.basketball import League
  league = League(league_id=1851873571, year=2027, espn_s2=ESPN_S2, swid=SWID)
  ```

- **Raw endpoint (unofficial):** for settings the library doesn't expose, like scoring categories. Send the same cookies. Verify the URL before relying on it.

  ```
  https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2027/segments/0/leagues/1851873571?view=mSettings
  ```

- **Auth:** the `espn_s2` and `SWID` cookies.
  - Kevin copies them from Chrome DevTools (Application → Cookies → fantasy.espn.com). SWID keeps its curly braces.
  - Load them from `.env`. Never hardcode them, log them, or commit them. Add `.env` to `.gitignore` from the first commit.
- **Caveats:**
  - The API is unofficial and undocumented, and can change without notice.
  - Cookies expire eventually. Show a clear "reconnect" error rather than failing silently.
  - Refresh no more than every 15–30 minutes.
- **NBA data:** prefer ESPN's data first. stats.nba.com (`nba_api`) often blocks requests and should only be added if ESPN's data isn't enough.

### Working style

- Kevin prefers concise communication and specific recommendations over long option lists.
- Ask before making decisions that are expensive to reverse, like changing the stack or adding scope.

---

## Stack

- **Backend:** Python, FastAPI, `espn-api`
- **Storage:** SQLite
- **Frontend:** Next.js
- **Hosting:** Local only

## Phase 0: Connect (1 weekend)

1. Put `ESPN_S2` and `SWID` in `.env`, and add `.gitignore`.
2. Write a script that pulls league settings, all rosters, the current matchup and the top free agents.
3. Print and record the scoring format, categories or point values, roster slots, lineup lock and acquisition limits. Update the "Still unknown" section above with the answers.

**Done when:** Kevin's roster and his opponent's roster print in the terminal, and the league settings are known.

**Status: done 2026-11-20.** `backend/espn_client.py` (the only ESPN module) and `backend/phase0.py`; run with `.venv/bin/python backend/phase0.py`. Settings are recorded under "League settings" above.

## Phase 1: Data layer (1 week)

1. Put all ESPN calls in one module (`espn_client.py`).
2. Save to SQLite:
   - **League:** rosters, matchups, free agents
   - **Players:** stats (season, last 7/15/30 days), ESPN projections, injury status
   - **NBA schedule:** games left this week per team
3. Refresh on a schedule: every few hours, plus once before lineup lock.

**Done when:** The database stays current without manual work.

## Phase 2: Recommendation engine (2–3 weeks)

1. **Projection per game:** Blend ESPN's projection, the season average and the last 14 days. Adjust for minutes trend, back-to-backs and injured teammates.
2. **Volume:** Multiply by games left in the matchup period.
3. **Value:**
   - **Points league:** projected fantasy points.
   - **Category league:** z-scores per category, weighted toward the categories that are close in this week's matchup.
4. **Start/sit:** Pick the best lineup that fits the roster slots each day or week. Start greedy; switch to the PuLP solver if position eligibility gets messy.
5. **Pickups:** For each free agent, compute the gain from swapping them for Kevin's weakest player, for both the rest of the week and the rest of the season.
6. **Reasons:** A one-line reason on every recommendation (e.g. "+2 games this week, boosts AST and STL where you're close").

**Done when:** The engine outputs a lineup and the top 5 pickups, each with a reason.

## Phase 3: Dashboard (1–2 weeks)

1. Kevin designs it in Figma first.
2. Four views:
   - **Today:** recommended lineup, with any changes from what's set
   - **Matchup:** projection vs. this week's opponent
   - **Free agents:** ranked, filterable by position
   - **Opponent:** roster and games left

**Done when:** Kevin checks this daily instead of ESPN's advice.

## Phase 4: Improve (ongoing)

1. Log each recommendation and what actually happened, then tune the weights from that.
2. Optional: a chat layer on top of the live league data, or a daily digest before lock.

## Out of scope (for now)

- Any writes to ESPN (lineups, adds/drops, trades)
- Multi-user accounts, syncing other people's leagues, Chrome extension
- Yahoo or other platforms
- Cloud hosting

## Risks

- **ESPN's API is unofficial and can change.** Keeping it in one module limits the damage.
- **The cookies expire.** Show a "reconnect" warning when they do.
- **Rate limits.** Refresh no more than every 15–30 minutes.
