# Dashboard (Phase 3)

Next.js app that shows the pipeline's output: Today, Matchup, Free agents and a detail page per free agent.
There is no backend. `scripts/copy-data.mjs` (run automatically before `dev` and `build`)
copies `../data/latest.json`, `track_record.json`, `actuals.json` and `lineups.json` into `public/data/`,
and the browser fetches them.

```bash
npm install
npm run dev        # http://localhost:3000
DATA_DIR=/path/to/sample npm run dev   # point at other pipeline output
```

- **Days:** the date stepper on Today and Matchup covers the whole matchup week. Today and later days show projections and moves; finished days show that day's lineup as set on ESPN, with each player's final points (`data/lineups.json` and `data/actuals.json`, both filled from ESPN's box scores by `pipeline/track_record.py`). The day's total counts starters only, so it matches ESPN. A day with no saved lineup falls back to today's roster, bench included, and says so.
- **Freshness:** every page shows when the data was last synced. If it's over 24 hours old, a banner says so.
- **Deploy:** on Vercel with Root Directory `web/`. Each data commit from GitHub Actions triggers a redeploy.

**Design:** the Broadcast scoreboard direction from Figma. Tokens are in `app/globals.css`; shared pieces (headshots, the source tags, game icons, the date stepper) are in `components/ui.tsx`; the joins between lineups, changes and players are in `lib/view.ts`. Facts from ESPN, the engine's projections and its recommendations each have their own look (solid, striped, blue), so a prediction never reads as a fact.
