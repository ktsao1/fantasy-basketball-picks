"use client";

import Link from "next/link";
import { usePageTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { STAT_NAMES, weeksLeft } from "@/lib/view";

// The engine's constants, as set in pipeline/engine/*.py. Keep these in step with the code.
const BLEND = [
  { label: "ESPN’s projection", w: 35 },
  { label: "Season average", w: 35 },
  { label: "Last 15 days", w: 30 },
];
const AVAILABILITY: [string, number][] = [["Active", 100], ["Probable", 90], ["Day-to-day", 65], ["Questionable", 55], ["Doubtful", 20], ["Out", 0]];

export default function HowItWorks() {
  usePageTitle("How it works");
  const { data } = useData();
  if (!data) return null;
  const items = [...(data.meta.scoring_items ?? [])].sort((a, b) => b.points - a.points);

  return (
    <article className="doc">
      <header className="doc-head">
        <h1>How it works</h1>
        <p className="doc-lede">
          Fantasy Picks reads one ESPN fantasy basketball league a few times a day and recommends who to start and
          which free agent to add. It never changes anything on ESPN. You make every move yourself.
        </p>
      </header>

      <section className="doc-sec" aria-labelledby="flow">
        <h2 id="flow">From ESPN to this page</h2>
        <Flow />
        <p>
          A scheduled job pulls the league from ESPN four times a day: after the night&rsquo;s games, after the morning
          injury news, and before afternoon and evening tip-offs. The engine turns that pull into
          recommendations and saves them as a file in the project&rsquo;s repository. This site reads that file, so it
          needs no server or database. The last pull was{" "}
          {new Date(data.meta.updated_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}{" "}
          ET.
        </p>
        <p>
          Every pull is also kept as a snapshot. Those snapshots are the log the{" "}
          <Link href="/track-record">track record</Link> grades against what players actually scored.
        </p>
      </section>

      <section className="doc-sec" aria-labelledby="proj">
        <h2 id="proj">Projecting each player</h2>
        <p>Points per game come from a weighted blend of three sources:</p>
        <div className="blend" role="img" aria-label="35% ESPN projection, 35% season average, 30% last 15 days">
          {BLEND.map((b) => (
            <span key={b.label} style={{ flexGrow: b.w }}>
              <b className="num">{b.w}%</b>
              <small>{b.label}</small>
            </span>
          ))}
        </div>
        <ul className="doc-list">
          <li><b>Minutes trend:</b> if he&rsquo;s played more minutes over the last week than his season average, the projection rises by half that change, capped at ±7.5%.</li>
          <li><b>Teammates out:</b> +4% for each high-usage teammate who is out, up to +8%.</li>
          <li><b>Back-to-backs:</b> −5% for the second game of a back-to-back.</li>
          <li><b>Thin samples:</b> a season average counts fully only after 8 games, and the last 15 days need at least 3.</li>
        </ul>
        <p>Then each game is multiplied by the chance he plays, from his ESPN injury status:</p>
        <table className="doc-table">
          <thead><tr><th scope="col">Status</th>{AVAILABILITY.map(([s]) => <th key={s} scope="col">{s}</th>)}</tr></thead>
          <tbody><tr><th scope="row">Chance he plays</th>{AVAILABILITY.map(([s, v]) => <td key={s} className="num">{v}%</td>)}</tr></tbody>
        </table>
      </section>

      <section className="doc-sec" aria-labelledby="lineup">
        <h2 id="lineup">Picking the lineup</h2>
        <p>
          Lineups lock player by player at each tip-off, so the engine plans one day at a time. For every remaining day of
          the matchup week it finds the best way to fill your 10 starting slots (PG, SG, SF, PF, C, G, F and three UT) from
          the players with a game. A player whose game has started stays where he is. The recommended moves are the
          differences between that lineup and the one set on ESPN.
        </p>
      </section>

      <section className="doc-sec" aria-labelledby="fa">
        <h2 id="fa">Ranking free agents</h2>
        <p>
          For the 30 best free agents, the engine tries swapping each one for each of your 5 weakest players. It never
          drops someone who projects higher per game, and it keeps you at 4 centers or fewer. Each swap gets two numbers:
        </p>
        <ul className="doc-list">
          <li><b>Gain this week:</b> your best lineups with the swap minus without it, counted from the day an add takes effect. Waiver claims take a day longer.</li>
          <li><b>Rest of season:</b> the difference in projected points over all their remaining games, times 85%, the share a rostered player usually starts.</li>
        </ul>
        <p className="formula">
          <span>Value</span> = gain this week + rest of season ÷ <span className="num">{weeksLeft(data)}</span> weeks left
        </p>
        <p>
          The value is what the ranking sorts by: this week plus a typical later week. That is why a player with a big week
          but little long-term upside can rank below one with a smaller week. Only one add a day is allowed, so the top 5
          are alternatives, not a shopping list.
        </p>
      </section>

      <section className="doc-sec" aria-labelledby="sure">
        <h2 id="sure">How sure it is</h2>
        <p>
          Fantasy points swing a lot from game to game. The engine assumes a typical spread of 35% of a player&rsquo;s
          projection, plus the chance he sits. From that it gives each projection an <b>80% range</b>, where the result
          should land 8 times out of 10. It works out the <b>chance to win</b> the matchup from both teams&rsquo; spreads
          together.
        </p>
        <p>
          The three data layers stay visually apart everywhere: <span className="src src-espn">ESPN</span> is what
          happened, <span className="src src-proj">Projected</span> is the engine&rsquo;s estimate, and{" "}
          <span className="tag tag-rec">blue</span> is what it recommends you do.
        </p>
      </section>

      {items.length > 0 && (
        <section className="doc-sec" aria-labelledby="scoring">
          <h2 id="scoring">Your league&rsquo;s scoring</h2>
          <p>All points use this league&rsquo;s own values, read from ESPN.</p>
          <div className="scoring">
            {items.map((it) => (
              <span key={it.stat} className={it.points < 0 ? "neg" : undefined}>
                <b className="num">{it.points > 0 ? `+${it.points}` : `−${Math.abs(it.points)}`}</b>
                <small>{STAT_NAMES[it.stat] ?? it.stat}</small>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="doc-sec" aria-labelledby="limits">
        <h2 id="limits">What it doesn&rsquo;t do</h2>
        <ul className="doc-list">
          <li><b>No writes to ESPN.</b> ESPN has no supported way to make moves, and a dropped player can&rsquo;t be recovered, so every move stays yours.</li>
          <li><b>Hand-set weights.</b> The blend and the spread are informed guesses until the track record has enough games to measure them.</li>
          <li><b>An unofficial API.</b> ESPN can change it without notice, and the sign-in cookies expire. If a pull is more than a day old, the site says so.</li>
        </ul>
      </section>
    </article>
  );
}

/** The data flow, drawn: ESPN → scheduled job → engine → JSON file → this site, with the grading loop back. */
function Flow() {
  const steps = [
    { t: "ESPN league", s: "Read only" },
    { t: "Scheduled job", s: "4× a day" },
    { t: "Engine", s: "Python" },
    { t: "JSON file", s: "In the repo" },
    { t: "This site", s: "Static" },
  ];
  return (
    <ol className="flow" aria-label="Data flow">
      {steps.map((x, i) => (
        <li key={x.t} className={i === 2 ? "core" : undefined}>
          <b>{x.t}</b>
          <small>{x.s}</small>
        </li>
      ))}
    </ol>
  );
}
