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
          Fantasy Picks uses your ESPN league data to recommend who to start and which free agents to add.
          You make each move yourself on ESPN.
        </p>
        <nav className="doc-jump" aria-label="On this page">
          <a href="#design">Design &amp; AI architecture</a>
          <a href="#proj">Projections</a>
          <a href="#lineup">Lineup picks</a>
          <a href="#fa">Free-agent Value</a>
          {items.length > 0 && <a href="#scoring">League scoring</a>}
        </nav>
      </header>

      <section className="doc-sec" aria-labelledby="design">
        <h2 id="design">Design &amp; AI architecture</h2>
        <p>
          I designed Fantasy Picks around a decision I make before tip-off. Today surfaces the next move.
          The player detail shows the evidence for that move. Matchup shows the projected point swing for each recommended pickup and the selected day’s lineup changes.
        </p>
        <ul className="doc-list">
          <li><b>Put the decision first.</b> The pickup card pairs the incoming and outgoing players up front, with a detailed comparison one click away. <a href="https://www.cs.umd.edu/users/ben/papers/Shneiderman1996eyes.pdf">Shneiderman’s overview and details on demand</a></li>
          <li><b>Show where the gain comes from.</b> The detail page names the factors driving the recommendation and shows how many points each adds. <a href="https://www.microsoft.com/en-us/haxtoolkit/guideline/make-clear-why-the-system-did-what-it-did/">Microsoft HAX, Guideline 11</a> · <a href="https://arxiv.org/abs/2102.02437">EUCA explanation framework</a></li>
          <li><b>Make uncertainty visible.</b> Each scored swap pairs its point estimate with a projected range. Matchup shows the ESPN score, the forecast as set, and the projected impact of recommendations. <a href="https://pair.withgoogle.com/chapter/explainability-trust/">Google PAIR on explainability and trust</a></li>
        </ul>
        <p>
          I used AI to synthesize the design research, prototype the lineup solver, and critique the interface. One critique
          caught a rankings problem. Free Agents was sorted by a combination of weekly gain and rest-of-season value,
          while the table only showed the weekly gain. The visible Value column now explains the order.
        </p>
        <p>
          The running app uses a rules-based Python engine. It blends scoring inputs, checks lineup and roster constraints,
          and saves the result as JSON. I set the league constraints and decide which recommendations to act on.
        </p>
      </section>

      <section className="doc-sec" aria-labelledby="flow">
        <h2 id="flow">From ESPN to this page</h2>
        <Flow />
        <p>
          A scheduled job pulls the league from ESPN four times a day: after the night&rsquo;s games, after the morning
          injury news, and before afternoon and evening tip-offs. The engine turns that pull into
          recommendations and saves them in a file the dashboard reads. The last pull was{" "}
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
        <dl className="availability" aria-label="Chance of playing by injury status">
          {AVAILABILITY.map(([status, chance]) => (
            <div key={status}><dt>{status}</dt><dd className="num">{chance}%</dd></div>
          ))}
        </dl>
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
          The engine evaluates every tracked free agent against your five weakest players eligible to drop. It only
          considers drops with lower projected points per game and keeps you at four centers or fewer. Each swap gets two numbers:
        </p>
        <ul className="doc-list">
          <li><b>Gain this week:</b> your best lineups with the swap minus without it, counted from the day an add takes effect. Waiver claims take a day longer.</li>
          <li><b>Rest of season:</b> the difference in projected points over all their remaining games, times 85%, the share a rostered player usually starts.</li>
        </ul>
        <p className="formula">
          <span>Value</span> = gain this week + rest of season ÷ <span className="num">{weeksLeft(data)}</span> weeks left
        </p>
        <p>
          The ranking uses the best eligible swap for each player with a Value of at least 1 point. The free-agent table
          shows every qualifying swap. Today shows the five highest-ranked options for your one add per day.
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
    { t: "Dashboard", s: "Recommendations" },
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
