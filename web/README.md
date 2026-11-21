# Dashboard (Phase 3)

Next.js app that shows the pipeline's output: Today, Matchup, Free agents and a detail page per free agent.
There is no backend. `scripts/copy-data.mjs` (run automatically before `dev` and `build`)
copies `../data/latest.json`, `../data/snapshots/featured.json` and the featured
snapshots into `public/data/`, and the browser fetches them.

```bash
npm install
npm run dev        # http://localhost:3000
DATA_DIR=/path/to/sample npm run dev   # point at other pipeline output
```

- **Live / Replay:** Replay steps through `data/snapshots/featured.json` (title + one-line description per entry).
- **Freshness:** every page shows "Last updated". If the live data is over 24 hours old, a banner appears and the dashboard defaults to Replay.
- **Deploy:** on Vercel with Root Directory `web/`. Each data commit from GitHub Actions triggers a redeploy.

**Design:** the Broadcast scoreboard direction from Figma. Tokens are in `app/globals.css`; shared pieces (headshots, the source tags, game icons, the date stepper) are in `components/ui.tsx`; the joins between lineups, changes and players are in `lib/view.ts`. Facts from ESPN, the engine's projections and its recommendations each have their own look (solid, striped, blue), so a prediction never reads as a fact.
