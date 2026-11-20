# Fantasy Basketball Tool: Build Plan

## Context for Claude Code

The user is Kevin, a designer and AI engineer. He plays in a 9-team ESPN fantasy basketball league (2026-27 season).

The tool reads live data from his ESPN league: his roster, his opponents' rosters and free agents. It recommends who to start or sit and which free agents to pick up, based on recent performance, matchups and schedule.

**This is Kevin's submission for Palantir's Product Design "Show & Tell" take-home.** Reviewers must be able to open a public link and click through it themselves, so the app can't depend on Kevin's laptop. Demo quality and reliability matter more than feature count.

This file is the agreed plan. Follow it phase by phase.

### Decisions already made (don't revisit unless asked)

- **Recommend-only.** The tool never writes to ESPN: no lineup changes, adds, drops or trades. Kevin makes all moves himself on ESPN.
  - Why: ESPN has no supported write API, dropped players can't be recovered, and automated writes risk his account.
- **Single league only.** League `1851873571`, team `14`, `year=2027`. No accounts, sign-in or multi-league support.
- **`espn-api` library, with every ESPN call in `pipeline/espn_client.py`.**
- **No always-on backend or database.** A Python pipeline (fetch → engine → JSON) runs in GitHub Actions a few times a day. It commits JSON files to the repo, and the Next.js dashboard on Vercel reads them directly.
- **Free to run.** GitHub Actions (free for public repos) and Vercel Hobby. No paid plans.
- **Kevin designs the UI in Figma.** Until those designs arrive, the views are functional and unstyled.

### League details

| | |
|---|---|
| **League URL** | https://fantasy.espn.com/basketball/team?leagueId=1851873571&teamId=14&seasonId=2027 |
| **League ID** | `1851873571` |
| **Kevin's team ID** | `14` |
| **Season** | `2027` (ESPN labels the 2026-27 season as 2027; pass `year=2027` to the API) |
| **Teams** | 9, so one team has a bye each week. Kevin's bye is week 7. |
| **Privacy** | Private, so the `espn_s2` and `SWID` cookies are required |

### League settings (answered in Phase 0, 2026-11-20)

Pulled from ESPN's `mSettings` view by `pipeline/phase0.py`.

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
- **Matchups:** 19 regular-season matchup periods, Monday to Sunday, and a 4-team playoff. Trade deadline 2027-02-26.
  - espn-api's per-team schedule skips bye weeks, which shifts its week numbers. Read matchups from the raw `mMatchupScore` view instead.
- **Acquisitions:** no season limit and no move limit, but **1 add per day** (matchup limit 1, applied per scoring period).
- **Waivers:** traditional (no FAAB), 24-hour waivers, processed Sundays, order doesn't reset.
- **Projections:** ESPN returns no matchup projection (`-1`) for this league, so the engine computes its own.
- **Scoring check:** ESPN's stored fantasy-point averages match a recalculation from these point values exactly.

### ESPN access

- **Library:** `espn-api` (https://github.com/cwendt94/espn-api), basketball module.
- **Raw views** (same cookies): `mSettings` for scoring items, roster slots and lock rules, and `mMatchupScore` for the schedule with matchup period IDs.
- **Secrets:**
  - **Locally:** `ESPN_S2` and `SWID` go in `.env`, which is gitignored. SWID keeps its curly braces.
  - **In the cloud:** they're stored as GitHub Actions secrets. Kevin enters them himself.
  - Never log them, commit them or send them to the frontend.
- **Caveats:**
  - The API is unofficial and undocumented, and can change without notice.
  - Cookies expire. Fail loudly with a clear "reconnect" message.
  - Refresh only a few times a day.

### Working style

- Kevin prefers concise communication and specific recommendations over long option lists.
- Ask before making decisions that are expensive to reverse, like changing the stack or adding scope.

---

## Architecture

```
GitHub Actions (cron 3–4×/day + manual)
  └─ pipeline/build_data.py: fetch (espn_client) → engine → validate (schema.json) → write
       ├─ data/latest.json
       └─ data/snapshots/<YYYY-MM-DD-HHMM>.json
     commit data/ only if something changed
Vercel (Next.js, web/) reads the JSON files directly. No backend API.
```

### Repo structure

```
pipeline/       espn_client.py, engine/, build_data.py (entry point), schema.json, phase0.py
data/           latest.json, snapshots/ (+ featured.json)
web/            Next.js app
.github/workflows/refresh.yml
requirements.txt, .env.example, .gitignore
```

### JSON output (validated against `pipeline/schema.json` before every write)

- **meta:** `updated_at`, season, scoring type, scoring settings, roster slots, lineup lock type.
- **my_team, opponent, matchup:** rosters and current projected totals (points, for this league).
- **players:** id, name, NBA team, positions, injury status, stats (season, last 7/15/30 days), projection, `games_left_this_week`.
- **recommendations:**
  - **lineup:** for each slot, the player and the reason.
  - **changes** vs. the current lineup.
  - **pickups:** add, drop, gain this week, gain rest of season, reason, confidence.
- **Anonymization:** with `ANONYMIZE=true` (the default), other managers' teams become "Opponent A" to "Opponent H". The letters stay the same between runs, so Replay snapshots line up. Kevin's own team keeps its name.

## Phase 0: Connect (done 2026-11-20)

`pipeline/espn_client.py` connects with the cookies from `.env`. `pipeline/phase0.py` prints settings, rosters, the matchup and free agents. The settings are recorded above.

## Phase 1: Pipeline → JSON + GitHub Actions

1. `build_data.py`: fetch → engine (stub until Phase 2) → JSON, validated against the schema.
   - It writes to a temporary file and only replaces `latest.json` once the output passes the schema.
   - On a cookie failure it exits non-zero with a clear message. `latest.json` is never overwritten with empty or partial data.
2. `refresh.yml`:
   - **Triggers:** cron about 3–4 times a day, plus `workflow_dispatch`.
   - **Steps:** set up Python → install deps → run `build_data.py` with the secrets as env vars → commit `data/` only if it changed.
3. **Test early that ESPN accepts requests from GitHub's servers.** If it blocks them, tell Kevin. The fallback is that Kevin runs `build_data.py` locally and pushes the data.

**Done when:** a scheduled run updates `data/latest.json` on GitHub without Kevin's laptop.

**Status: done 2026-11-20.**
- **ESPN accepts requests from GitHub's servers.** The check-only run passed, and the first full run committed `5493f60`.
- **Schedule (UTC):** 07:00, 14:00, 18:30 and 22:30, which is about 2am, 9am, 1:30pm and 5:30pm ET.
- **Exit codes:** `build_data.py` exits 2 on expired cookies and 3 on a schema failure. Either way it leaves `data/` untouched.
- **Size:** snapshots are compact JSON, about 37 KB gzipped each.

## Phase 2: Recommendation engine (inside the pipeline)

1. **Projection per game:** Blend ESPN's projection, the season average and the last 14 days. Adjust for minutes trend, back-to-backs and injured teammates.
2. **Volume:** Multiply by games left in the matchup period.
3. **Value:**
   - **Points league (this league):** projected fantasy points.
   - **Category league:** z-scores per category, weighted toward close categories. This league doesn't need it.
4. **Start/sit:** Pick the best lineup that fits the roster slots each day. Start greedy; switch to the PuLP solver if position eligibility gets messy.
5. **Pickups:** For each free agent, compute the gain from swapping them for Kevin's weakest player, for both the rest of the week and the rest of the season. Respect the 1-add-per-day limit.
6. **Reason + confidence on every recommendation:**
   - A one-line reason, e.g. "+2 games this week, 41 fpts/g over the last 15 days".
   - A confidence of high, medium or low, with a short basis such as "small sample" or "injury status questionable".
   - The engine's output only goes into the JSON.

**Done when:** the JSON has a lineup and the top 5 pickups, each with a reason and a confidence.

**Status: done 2026-11-20 (engine 1.0).** The code is in `pipeline/engine/`, with tests in `pipeline/tests/` that run in the workflow before each build.
- **Projection:**
  - The blend is ESPN 0.35, season 0.35, last 15 days 0.30. When ESPN has no projection (most free agents), the season average takes ESPN's weight.
  - Adjustments: minutes trend (last 7 vs. season, ±7.5% max), +4% per injured high-usage teammate (max +8%), and −5% on the second night of a back-to-back.
  - Availability by status: DAY_TO_DAY 0.65, OUT 0 this week, and OUT 0.6 for the rest of the season, since ESPN gives no return dates.
- **Lineups:** an exact DP for each remaining day.
  - Players whose game has started stay locked.
  - Ties keep players in their current slots, so no pointless moves get suggested.
  - Each "start" is paired with the player currently in that slot, matching ESPN's swaps.
- **Pickups:** the top 30 free agents are tried against Kevin's 5 weakest players.
  - Score = this week's lineup gain + rest-of-season gain ÷ weeks left.
  - Respects the add lock (`meta.adds_effective_date`), the one-day waiver delay and the 4-center limit.
  - Never drops a player who projects higher per game. Without this rule it suggested dropping an injured Stephen Curry.
- **Known limits:** the weights are hand-set until Phase 4 measures accuracy. The 5 pickups often share the same drop; they're alternatives, since only 1 add is allowed per day.
- **Engine 1.1 (2026-11-20): structured reasons and ranges for the design.**
  - Every lineup slot, change and pickup has ranked `factors` (`pipeline/engine/factors.py`): `{key, label, value, compare, unit, impact_fpts}`.
  - On a pickup, the drivers add up to `gain_this_week`: per-game quality on shared days, extra games, injury discounts, and a "lineup fit" remainder when the solver's result differs by 1 fpt or more.
  - Supporting signals (form, minutes, usage, waivers) have no impact value.
  - `reason` is unchanged and stays as the plain-text fallback.
  - Pickups have `gain_this_week_range`. `matchup_projection` has `mine_range`, `opponent_range` and `win_probability`.
  - Ranges are 80% intervals from each player's game-to-game variance (a hand-set coefficient of variation of 0.35, plus the chance he sits) and assume independent games.
  - Snapshots from engine 1.0 don't have these fields, so the web types treat them as optional.

## Phase 3: Dashboard on Vercel

1. Kevin provides Figma designs. Until then, build functional, unstyled views.
2. Four views: **Today** (recommended lineup and changes from what's set), **Matchup** (projection vs. this week's opponent), **Free agents** (ranked, filterable by position), **Opponent** (roster and games left).
3. **Live / Replay toggle.** Replay steps through the curated snapshots in `data/snapshots/featured.json`: 3–5 entries, each with a title and a one-line description of why it's interesting.
4. **"Last updated"** on every page. If the data is more than 24 hours old, show a banner and default to Replay.
5. Every recommendation shows its reason and confidence.
6. Anonymization is on by default.

**Done when:** someone with only the link understands it and clicks through in under 2 minutes.

**Status: live, unstyled, 2026-11-20.** https://fantasy-basketball-picks.vercel.app
- **Hosting:** Vercel project `fantasy-basketball-picks`, Root Directory `web/`. Each push, including the pipeline's data commits, redeploys the site.
- **Data loading:** `web/scripts/copy-data.mjs` runs before `dev` and `build`. It copies `data/latest.json`, `featured.json` and the featured snapshots into `public/data/`, and the browser fetches them.
- **Built:** all four views, Live/Replay, "Last updated", a stale banner that defaults to Replay after 24 hours, and reason + confidence on every recommendation. Checked locally (including stale data and phone width) and on the live site.
- **Config:** the scaffold's `cacheComponents` and `partialPrefetching` are off. With them on, the page never loaded in the browser.
- **Still open:**
  - Curate 3–5 Replay snapshots, including a day with real lineup changes. Only one real snapshot exists so far.
  - Apply Kevin's Figma designs.

## Phase 4: Accuracy + presentation polish

1. Log every recommendation with its timestamp, then record what actually happened (fantasy points) after the games.
2. A simple "How accurate has it been" view built from that log.
3. Polish for the presentation.

## Out of scope

- Any writes to ESPN (lineups, adds/drops, trades)
- Multi-user support, other leagues, other platforms
- An always-on backend or database

## Risks

- **ESPN's API is unofficial and can change.** Keeping it in one module limits the damage.
- **ESPN may block GitHub's servers.** Test this first; the fallback is a local run plus a push.
- **The cookies expire.** The workflow fails loudly, the dashboard shows "Last updated", and stale data defaults the dashboard to Replay.
- **GitHub pauses scheduled workflows** in public repos after 60 days without commits. The pipeline's own data commits keep the repo active.
