"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, Chevron, Empty, Games, Meter, Photo, Tag, usePageTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, injury, lastName, positions, signed, splitAvg, unavailable, weekday } from "@/lib/format";
import type { Data, Factor, Pickup, Player } from "@/lib/types";
import {
  addStart, addTiming, dropCaution, ESPN_TEAM_URL, gameOn, perWeekLater, pickupFor, pickupValue, pointsBreakdown, pts, STAT_NAMES,
} from "@/lib/view";

const DRIVER_TITLE: Partial<Record<Factor["key"], string>> = {
  schedule: "Schedule", per_game: "Per-game quality", availability: "Availability", lineup_fit: "Lineup fit",
  injury: "Injury", projection: "Projection", back_to_back: "Back-to-back",
};
const SIGNAL_TITLE: Partial<Record<Factor["key"], string>> = {
  form: "Recent form", minutes: "Minutes", usage: "Bigger role", per_game: "Per-game quality", waivers: "On waivers",
};

export default function FreeAgentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, players } = useData();
  const p = players.get(Number(id));
  usePageTitle(p ? p.name : "Free agent");
  if (!data) return null;
  if (!p || p.owner != null) {
    return (
      <div className="stack">
        <Back />
        <Empty>That player isn&rsquo;t one of the free agents tracked in this snapshot.</Empty>
      </div>
    );
  }
  const rec = pickupFor(data, p.id);
  const pick = rec?.pickup;
  const drop = pick?.drop_player_id != null ? players.get(pick.drop_player_id) : undefined;
  const games = (p.week_games ?? []).filter((g) => !g.started);
  const inj = injury(p);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <Back />

      <section className="band hero on-dark" aria-label="Verdict">
        <Photo p={p} w={200} h={148} dim={unavailable(p)} />
        <div className="hero-id">
          {(rec?.rank === 0 || inj) && (
            <div className="chips" style={{ gap: 8 }}>
              {rec?.rank === 0 && <Tag tone="light">Top pick</Tag>}
              {inj && <Tag tone="glass">{inj}</Tag>}
            </div>
          )}
          <h1>{p.name}</h1>
          <p className="line">{p.nba_team} · {positions(p)}{p.free_agent_status === "WAIVERS" ? " · On waivers" : ""}</p>
          <div className="chips" style={{ gap: 8, alignItems: "center" }}>
            {games.length === 0 && <span className="game-chip"><span>No games left this week</span></span>}
            {games.map((g) => (
              <span className="game-chip" key={g.date}>
                <b>{dayShort(g.date).split(",")[0]}</b>
                <span>{g.home ? "vs" : "@"} {g.opponent}</span>
              </span>
            ))}
          </div>
        </div>
        {pick && drop ? <Verdict pick={pick} drop={drop} /> : (
          <div className="verdict">
            <span className="num" style={{ color: "#fff" }}>{fmt(p.projection.engine_week_fpts)}</span>
            <small>proj. pts this week · not one of the top {data.recommendations.pickups.length} swaps</small>
          </div>
        )}
      </section>

      {pick && drop && <Action data={data} p={p} drop={drop} />}
      {pick && rec && rec.rank > 0 && <NotFirst data={data} pick={pick} p={p} />}

      <div className="cols">
        <div className="stack" style={{ gap: 24 }}>
          {pick && drop && <Why pick={pick} p={p} drop={drop} />}
          <Breakdown data={data} p={p} />
        </div>
        <div className="stack" style={{ gap: 24 }}>
          {drop ? <Versus data={data} p={p} drop={drop} /> : <Form p={p} />}
        </div>
      </div>
    </div>
  );
}

/** The move, with the timing caution first when the player you'd drop is playing today. */
function Action({ data, p, drop }: { data: Data; p: Player; drop: Player }) {
  const caution = dropCaution(data, drop);
  const g = gameOn(drop, data.meta.today);
  return (
    <div className="action">
      {caution && <p className="caution action-caution">{caution}</p>}
      <span className="pair">
        <Photo p={p} size={32} round />
        <Photo p={drop} size={32} round dim />
      </span>
      <div className="grow">
        <b>Add {p.name}, drop {drop.name}</b>
        <small>{addTiming(data)}</small>
      </div>
      <a className="btn" href={ESPN_TEAM_URL} target="_blank" rel="noreferrer">
        {g ? `After ${lastName(drop.name)}’s game: open ESPN` : "Make the move on ESPN"} <Chevron dir="up-right" />
        <span className="sr-only"> (opens ESPN in a new tab)</span>
      </a>
    </div>
  );
}

/** For anyone but the top pick: why the ranking puts him below it, in the ranking's own terms. */
function NotFirst({ data, pick, p }: { data: Data; pick: Pickup; p: Player }) {
  const top = data.recommendations.pickups[0];
  const { players } = useData();
  const t = players.get(top.add_player_id);
  if (!t) return null;
  const rank = data.recommendations.pickups.findIndex((x) => x.add_player_id === p.id) + 1;
  const dWeek = pick.gain_this_week - top.gain_this_week;
  const dLater = perWeekLater(data, pick) - perWeekLater(data, top);
  const name = lastName(p.name), tn = lastName(t.name);
  const tail = dWeek > 0 && dLater < 0
    ? `${name} gives more this week, but ${tn} is worth ${fmt(-dLater)} more in a typical week after, for the rest of the season.`
    : dWeek <= 0 && dLater <= 0
      ? `${tn} is ahead both this week and after it.`
      : `${name} is worth more after this week, but ${tn} gives more now.`;
  return (
    <section className="notfirst" aria-label={`Why ${name} ranks below ${tn}`}>
      <div className="notfirst-head">
        <b>Why #{rank}, not #1</b>
        <span>{tail}</span>
        <Link href={`/free-agents/${t.id}`} className="notfirst-link">See {tn} <Chevron dir="right" /></Link>
      </div>
      <table className="nf-table">
        <thead>
          <tr><th /><th scope="col">{name}</th><th scope="col">{tn}</th><th scope="col">Difference</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">Gain this week</th><td className="num">{signed(pick.gain_this_week)}</td><td className="num">{signed(top.gain_this_week)}</td><td className={`num ${dWeek >= 0 ? "up" : "down"}`}>{signed(dWeek)}</td></tr>
          <tr><th scope="row">A typical later week</th><td className="num">{signed(perWeekLater(data, pick))}</td><td className="num">{signed(perWeekLater(data, top))}</td><td className={`num ${dLater >= 0 ? "up" : "down"}`}>{signed(dLater)}</td></tr>
          <tr className="nf-total"><th scope="row">Value</th><td className="num">{fmt(pickupValue(data, pick))}</td><td className="num">{fmt(pickupValue(data, top))}</td><td className={`num ${pickupValue(data, pick) >= pickupValue(data, top) ? "up" : "down"}`}>{signed(pickupValue(data, pick) - pickupValue(data, top))}</td></tr>
        </tbody>
      </table>
    </section>
  );
}

function Back() {
  return (
    <Link href="/free-agents" className="back">
      <Chevron dir="left" /> Free agents
    </Link>
  );
}

function Verdict({ pick, drop }: { pick: Pickup; drop: Player }) {
  const r = pick.gain_this_week_range;
  const max = Math.max(10, (r?.[1] ?? pick.gain_this_week) * 1.15);
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  return (
    <div className="verdict">
      <span className="num">{signed(pick.gain_this_week)}</span>
      <small>proj. pts this week over {drop.name}</small>
      {r && (
        <>
          <div className="range" role="img" aria-label={`80% range ${signed(r[0])} to ${signed(r[1])}`}>
            <span className="range-track">
              <span className="base" />
              <span className="rband hatch" style={{ left: pct(r[0]), width: `calc(${pct(r[1])} - ${pct(r[0])})` }} />
              <span className="mark" style={{ left: `calc(${pct(pick.gain_this_week)} - 1px)` }} />
            </span>
            <span>likely {signed(r[0], 0)} to {signed(r[1], 0)}</span>
          </div>
        </>
      )}
      <Meter c={pick.confidence} />
    </div>
  );
}

// Signals the add-vs-drop table already shows side by side.
const IN_TABLE = new Set<Factor["key"]>(["form", "minutes", "per_game"]);

function Why({ pick, p, drop }: { pick: Pickup; p: Player; drop: Player }) {
  const factors = pick.factors ?? [];
  const drivers = factors.filter((f) => f.impact_fpts != null);
  const signals = factors.filter((f) => f.impact_fpts == null && !IN_TABLE.has(f.key));
  return (
    <Card title="Why he’s a good add" sub={`Where the ${signed(pick.gain_this_week)} comes from.`}>
      {drivers.map((f, i) => (
        <div className="driver" key={f.key}>
          <span className="rank">{i + 1}</span>
          <div className="who">
            <strong style={{ fontSize: 15, fontWeight: 600 }}>{DRIVER_TITLE[f.key] ?? f.key}</strong>
            <small style={{ fontSize: 13, fontWeight: 400 }}>{pts(f.label)}</small>
          </div>
          <DriverVisual f={f} p={p} drop={drop} />
          <div className="impact">
            <span className="num" style={f.impact_fpts! < 0 ? { color: "var(--neg)" } : undefined}>{signed(f.impact_fpts)}</span>
            <small>pts</small>
          </div>
        </div>
      ))}
      <div style={{ paddingTop: 8 }}>
        <p className="section-label" style={{ margin: "8px 0 2px" }}>Also in his favour over {lastName(drop.name)} · not counted above</p>
        {signals.map((f) => (
          <div className="signal" key={f.key}>
            <div className="who">
              <strong style={{ fontWeight: 600 }}>{SIGNAL_TITLE[f.key] ?? f.key}</strong>
              <small style={{ fontWeight: 400 }}>{pts(f.label)}</small>
            </div>
            <Delta f={f} />
          </div>
        ))}
        <div className="signal">
          <div className="who">
            <strong style={{ fontWeight: 600 }}>Rest of season</strong>
            <small style={{ fontWeight: 400 }}>{signed(pick.gain_rest_of_season, 0)} proj. pts over {p.games_left_season ?? "his remaining"} games</small>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Delta({ f }: { f: Factor }) {
  if (f.value == null || f.compare == null) return null;
  const up = f.value >= f.compare;
  const text = f.unit === "mpg" ? `${signed(f.value - f.compare)} min` : f.compare ? `${up ? "+" : "−"}${Math.abs(Math.round(((f.value - f.compare) / f.compare) * 100))}%` : signed(f.value - f.compare);
  return <Tag tone={up ? "pos" : "neg"}>{text}</Tag>;
}

function DriverVisual({ f, p, drop }: { f: Factor; p: Player; drop: Player }) {
  if (f.value == null || f.compare == null) return <div className="driver-vis" />;
  const rows: [string, number][] = [[lastName(p.name), f.value], [lastName(drop.name), f.compare]];
  if (f.unit === "games") {
    const of = Math.max(3, f.value, f.compare);
    return (
      <div className="driver-vis">
        {rows.map(([n, v]) => <div key={n}><label>{n}</label><Games n={v} of={of} /><span className="val">{v}</span></div>)}
      </div>
    );
  }
  const max = Math.max(f.value, f.compare, 1);
  return (
    <div className="driver-vis">
      {rows.map(([n, v], i) => (
        <div key={n}>
          <label>{n}</label>
          <span className="bar" style={{ width: `${(v / max) * 110}px`, opacity: i ? 0.35 : 1 }} />
          <span className="val">{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

function Breakdown({ data, p }: { data: Data; p: Player }) {
  const rows = pointsBreakdown(data, p);
  const line = p.stats.last_15?.gp ? p.stats.last_15 : p.stats.season;
  if (!rows.length || !line) return null;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const window = p.stats.last_15?.gp ? `last 15 days` : `season`;
  return (
    <details className="card fold">
      <summary>
        <span className="grow">
          <h2>Where his points come from</h2>
          <p>Per game, {window}, in your league&rsquo;s scoring</p>
        </span>
        <span className="num" style={{ fontSize: 22 }}>{fmt(total)}</span>
        <Chevron dir="right" />
      </summary>
      <div className="breakdown">
        {rows.map((r) => (
          <div className="bd-row" key={r.stat}>
            <span>{STAT_NAMES[r.stat] ?? r.stat}</span>
            <small>{r.per.toFixed(1)} × {r.points < 0 ? `−${Math.abs(r.points)}` : r.points}</small>
            <span className="bd-axis" aria-hidden>
              {r.value !== 0 && (
                <span style={{
                  width: `${(Math.abs(r.value) / max) * 50}%`,
                  left: r.value > 0 ? "50%" : `${50 - (Math.abs(r.value) / max) * 50}%`,
                  background: r.value > 0 ? "var(--ink)" : "var(--neg)", opacity: 0.85,
                }} />
              )}
            </span>
            <span className="num" style={r.value < 0 ? { color: "var(--neg)" } : undefined}>
              {r.value > 0 ? "+" : r.value < 0 ? "−" : ""}{Math.abs(r.value).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
      <div className="total-row" style={{ marginTop: 8 }}>
        Fantasy points per game
        <span className="num">{fmt(total)}</span>
      </div>
      {p.projection.engine_fpts_per_game != null && (
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          His projection ({fmt(p.projection.engine_fpts_per_game)}/g) also weighs ESPN&rsquo;s projection, minutes and schedule.
        </p>
      )}
    </details>
  );
}

function Versus({ data, p, drop }: { data: Data; p: Player; drop: Player }) {
  // Only the games the swap changes: from the day the add would count.
  const from = addStart(data, p);
  const day = weekday(from).slice(0, 3);
  const games = (x: Player) => (x.game_dates_left ?? []).filter((d) => d >= from).length;
  const proj = (x: Player) => {
    const week = x.projection.engine_week_fpts, all = x.game_dates_left?.length ?? 0;
    return week == null ? null : all ? (week * games(x)) / all : 0;
  };
  const rows: [string, number | null, number | null, boolean?][] = [
    ["Proj. pts per game", p.projection.engine_fpts_per_game ?? null, drop.projection.engine_fpts_per_game ?? null, true],
    [`Games from ${day}`, games(p), games(drop)],
    [`Proj. pts from ${day}`, proj(p), proj(drop), true],
    ["Pts per game, last 15 days", splitAvg(p.stats.last_15), splitAvg(drop.stats.last_15)],
    ["Minutes, last 15 days", p.stats.last_15?.mpg ?? null, drop.stats.last_15?.mpg ?? null],
    ["Pts per game, season", splitAvg(p.stats.season), splitAvg(drop.stats.season)],
  ];
  // Only call a winner when the gap is meaningful: 5% or one whole game.
  const clear = (x: number | null, y: number | null) => x != null && y != null && x - y >= Math.max(0.05 * Math.abs(y), 0.5);
  const dropWins = rows.filter(([, a, b]) => clear(b, a)).map(([m]) => m.toLowerCase());
  const list = (xs: string[]) => (xs.length < 2 ? xs[0] : `${xs.slice(0, -1).map((x) => `“${x}”`).join(", ")} and “${xs[xs.length - 1]}”`);
  const digits = (m: string) => (m.startsWith("Games") ? 0 : 1);
  return (
    <Card title={`${lastName(p.name)} vs ${lastName(drop.name)}`}>
      <table className="vs-table">
        <thead>
          <tr>
            <th />
            <th><Photo p={p} size={36} round />{lastName(p.name)}<small style={{ color: "var(--pos)" }}>Add</small></th>
            <th><Photo p={drop} size={36} round dim />{lastName(drop.name)}<small className="muted">Drop</small></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([m, a, b, proj]) => (
            <tr key={m}>
              <td>{m}{proj && <span className="hatch" style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, marginLeft: 6, verticalAlign: -1 }} title="Projected" />}</td>
              <td className={`v${clear(a, b) ? " win" : ""}`}><span className="num">{fmt(a, digits(m))}</span></td>
              <td className={`v${clear(b, a) ? " win" : ""}`}><span className="num">{fmt(b, digits(m))}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        {dropWins.length === 0
          ? `${lastName(p.name)} is ahead or level on every measure.`
          : `${lastName(drop.name)} is ahead on ${dropWins.length === 1 ? `“${dropWins[0]}”` : list(dropWins)}; ${lastName(p.name)} wins on the rest, including this week.`}
      </p>
    </Card>
  );
}

/** Only for a free agent with no recommended swap; otherwise the add-vs-drop table covers form. */
function Form({ p }: { p: Player }) {
  const windows: [string, "season" | "last_30" | "last_15" | "last_7"][] = [["Season", "season"], ["Last 30", "last_30"], ["Last 15", "last_15"], ["Last 7", "last_7"]];
  const max = Math.max(...windows.map(([, k]) => splitAvg(p.stats[k]) ?? 0), 1);
  return (
    <Card title="Form" sub="Fantasy pts per game">
      <div className="form-chart">
        {windows.map(([label, k]) => {
          const v = splitAvg(p.stats[k]);
          return (
            <div className="form-col" key={k}>
              <div className="form-bars">
                <div>
                  {fmt(v)}
                  <span style={{ height: `${((v ?? 0) / max) * 110}px` }} />
                </div>
              </div>
              {label}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
