"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, Chevron, Empty, Games, Meter, Photo, Source, Tag } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, injury, lastName, positions, signed, splitAvg, tip, unavailable } from "@/lib/format";
import type { Data, Factor, Pickup, Player } from "@/lib/types";
import { ESPN_TEAM_URL, pickupFor, pointsBreakdown, STAT_NAMES } from "@/lib/view";

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
  if (!data) return null;
  const p = players.get(Number(id));
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
          <div className="chips" style={{ gap: 8 }}>
            {rec?.rank === 0 ? <Tag tone="light">Top pick</Tag> : rec ? <Tag tone="light">Recommended #{rec.rank + 1}</Tag> : null}
            <Tag tone="glass">{inj || "Healthy"}</Tag>
          </div>
          <h1>{p.name}</h1>
          <p className="line">{p.nba_team} · {positions(p)} · {p.free_agent_status === "WAIVERS" ? "On waivers" : "Free agent"}</p>
          <div className="chips" style={{ gap: 8, alignItems: "center" }}>
            <Source kind="espn">Schedule</Source>
            {games.length === 0 && <span className="game-chip"><span>No games left this week</span></span>}
            {games.map((g) => (
              <span className="game-chip" key={g.date}>
                <Games n={1} color="#fff" size={12} />
                <b>{dayShort(g.date).split(",")[0]}</b>
                <span>{g.home ? "vs" : "@"} {g.opponent} · {tip(g.start_utc)}</span>
              </span>
            ))}
          </div>
        </div>
        {pick && drop ? <Verdict pick={pick} drop={drop} /> : (
          <div className="verdict">
            <Source kind="proj" />
            <span className="num" style={{ color: "#fff" }}>{fmt(p.projection.engine_week_fpts)}</span>
            <small>proj. pts this week · no swap beats your roster</small>
          </div>
        )}
      </section>

      {pick && drop && (
        <div className="action">
          <span className="pair">
            <Photo p={p} size={32} round />
            <Photo p={drop} size={32} round dim />
          </span>
          <div className="grow">
            <b>Add {p.name}, drop {drop.name}</b>
            <small>Recommended · {data.meta.adds_effective_date && data.meta.adds_effective_date > data.meta.today ? "adds made now count from tomorrow" : "adds lock at today's first tip"} · 1 add per day</small>
          </div>
          <a className="btn" href={ESPN_TEAM_URL} target="_blank" rel="noreferrer">
            Make the move on ESPN <Chevron dir="up-right" />
          </a>
        </div>
      )}

      <div className="cols">
        <div className="stack" style={{ gap: 24 }}>
          {pick && drop && <Why pick={pick} p={p} drop={drop} />}
          <Breakdown data={data} p={p} />
        </div>
        <div className="stack" style={{ gap: 24 }}>
          {drop && <Versus p={p} drop={drop} />}
          <Form p={p} drop={drop} />
          {pick && (
            <Card title="How sure is this?">
              <Meter c={pick.confidence} />
              <p style={{ marginTop: 12 }}>Based on: {pick.confidence.basis}.{pick.gain_this_week_range ? ` The gain is likely between ${signed(pick.gain_this_week_range[0])} and ${signed(pick.gain_this_week_range[1])} fpts.` : ""}</p>
              <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                Fantasy Picks only recommends. Check injury news before tip-off, then make the move yourself on ESPN.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
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
      <Source kind="proj" />
      <span className="num">{signed(pick.gain_this_week)}</span>
      <small>fpts this week if you swap him for {drop.name}</small>
      {r && (
        <>
          <div className="range" role="img" aria-label={`80% range ${signed(r[0])} to ${signed(r[1])}`}>
            <span>+0</span>
            <span className="range-track">
              <span className="base" />
              <span className="rband hatch" style={{ left: pct(r[0]), width: `calc(${pct(r[1])} - ${pct(r[0])})` }} />
              <span className="mark" style={{ left: `calc(${pct(pick.gain_this_week)} - 1px)` }} />
            </span>
            <span>+{Math.round(max)}</span>
          </div>
          <small>Likely between {signed(r[0])} and {signed(r[1])} (80% range)</small>
        </>
      )}
      <Meter c={pick.confidence} />
    </div>
  );
}

function Why({ pick, p, drop }: { pick: Pickup; p: Player; drop: Player }) {
  const factors = pick.factors ?? [];
  const drivers = factors.filter((f) => f.impact_fpts != null);
  const signals = factors.filter((f) => f.impact_fpts == null);
  const total = drivers.reduce((s, f) => s + Math.abs(f.impact_fpts!), 0) || 1;
  return (
    <Card
      title="Why he’s a good add"
      sub={drivers.length > 1 ? `The ${signed(pick.gain_this_week)} comes from ${drivers.length} drivers, which add up to it.` : `Where the ${signed(pick.gain_this_week)} comes from.`}
      aside={<Source kind="proj" />}
    >
      <div className="contrib" role="img" aria-label="Share of the gain by driver">
        {drivers.map((f) => (
          <span key={f.key} className="hatch" style={{ flex: Math.abs(f.impact_fpts!) / total, ["--c" as string]: f.impact_fpts! < 0 ? "var(--neg)" : "var(--pos)" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, margin: "8px 0 10px" }}>
        {drivers.map((f) => <span key={f.key}>{DRIVER_TITLE[f.key] ?? f.label} {signed(f.impact_fpts)}</span>)}
      </div>
      {drivers.map((f, i) => (
        <div className="driver" key={f.key}>
          <span className="rank">{i + 1}</span>
          <div className="who">
            <strong style={{ fontSize: 15, fontWeight: 600 }}>{DRIVER_TITLE[f.key] ?? f.key}</strong>
            <small style={{ fontSize: 13, fontWeight: 400 }}>{f.label}</small>
          </div>
          <DriverVisual f={f} p={p} drop={drop} />
          <div className="impact">
            <span className="num" style={f.impact_fpts! < 0 ? { color: "var(--neg)" } : undefined}>{signed(f.impact_fpts)}</span>
            <small>fpts</small>
          </div>
        </div>
      ))}
      {(signals.length > 0 || pick.gain_rest_of_season) && (
        <div style={{ paddingTop: 8 }}>
          <p style={{ fontWeight: 600, fontSize: 13 }}>Supporting signals</p>
          <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>These back up the drivers but aren&rsquo;t counted in the gain.</p>
          {signals.map((f) => (
            <div className="signal" key={f.key}>
              <Tag>Signal</Tag>
              <div className="who">
                <strong style={{ fontWeight: 600 }}>{SIGNAL_TITLE[f.key] ?? f.key}</strong>
                <small style={{ fontWeight: 400 }}>{f.label}{f.compare != null && f.unit === "fpts/g" && f.key === "form" ? `, vs ${fmt(f.compare)} season` : ""}{f.compare != null && f.unit === "mpg" ? ` (${fmt(f.value)} vs ${fmt(f.compare)} min/g)` : ""}</small>
              </div>
              <Delta f={f} />
            </div>
          ))}
          <div className="signal">
            <Tag>Signal</Tag>
            <div className="who">
              <strong style={{ fontWeight: 600 }}>Value after this week</strong>
              <small style={{ fontWeight: 400 }}>{signed(pick.gain_rest_of_season)} projected fpts over the rest of the season</small>
            </div>
            <Tag>{p.games_left_season ?? "—"} games left</Tag>
          </div>
        </div>
      )}
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
  const window = p.stats.last_15?.gp ? `the last 15 days (${p.stats.last_15.gp} games)` : `the season (${line.gp} games)`;
  return (
    <Card title="Where his points come from" sub={`Per game over ${window}, using your league’s scoring.`} aside={<Source kind="espn">ESPN stats</Source>}>
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
    </Card>
  );
}

function Versus({ p, drop }: { p: Player; drop: Player }) {
  const rows: [string, number | null, number | null, boolean?][] = [
    ["Proj. fpts per game", p.projection.engine_fpts_per_game ?? null, drop.projection.engine_fpts_per_game ?? null, true],
    ["Games left this week", p.games_left_this_week, drop.games_left_this_week],
    ["Proj. fpts this week", p.projection.engine_week_fpts ?? null, drop.projection.engine_week_fpts ?? null, true],
    ["Last 7 days, fpts/g", splitAvg(p.stats.last_7), splitAvg(drop.stats.last_7)],
    ["Last 15 days, fpts/g", splitAvg(p.stats.last_15), splitAvg(drop.stats.last_15)],
    ["Minutes, last 15 days", p.stats.last_15?.mpg ?? null, drop.stats.last_15?.mpg ?? null],
    ["Season, fpts/g", splitAvg(p.stats.season), splitAvg(drop.stats.season)],
  ];
  const dropWins = rows.filter(([, a, b]) => a != null && b != null && b > a).map(([m]) => m.toLowerCase());
  const digits = (m: string) => (m.startsWith("Games") ? 0 : 1);
  return (
    <Card title={`${lastName(p.name)} vs ${lastName(drop.name)}`} sub="Same measures for the player you add and the one you drop.">
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
              <td className={`v${a != null && b != null && a > b ? " win" : ""}`}><span className="num">{fmt(a, digits(m))}</span></td>
              <td className={`v${a != null && b != null && b > a ? " win" : ""}`}><span className="num">{fmt(b, digits(m))}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        {dropWins.length === 0
          ? `${lastName(p.name)} is ahead on every measure.`
          : `${lastName(drop.name)} is ahead on ${dropWins.join(" and ")}; ${lastName(p.name)} wins on the rest, including this week.`}
      </p>
    </Card>
  );
}

function Form({ p, drop }: { p: Player; drop?: Player }) {
  const windows: [string, "season" | "last_30" | "last_15" | "last_7"][] = [["Season", "season"], ["Last 30", "last_30"], ["Last 15", "last_15"], ["Last 7", "last_7"]];
  const vals = windows.flatMap(([, k]) => [splitAvg(p.stats[k]), drop ? splitAvg(drop.stats[k]) : null]).filter((v): v is number => v != null);
  const max = Math.max(...vals, 1);
  return (
    <Card title="Form by time window" sub="Fantasy points per game." aside={<Source kind="espn">ESPN stats</Source>}>
      {drop && (
        <div className="legend" style={{ marginBottom: 12 }}>
          <span><i style={{ background: "var(--ink)", borderRadius: 2 }} />{lastName(p.name)}</span>
          <span><i style={{ background: "var(--ink)", opacity: 0.3, borderRadius: 2 }} />{lastName(drop.name)}</span>
        </div>
      )}
      <div className="form-chart">
        {windows.map(([label, k]) => (
          <div className="form-col" key={k}>
            <div className="form-bars">
              {[splitAvg(p.stats[k]), ...(drop ? [splitAvg(drop.stats[k])] : [])].map((v, i) => (
                <div key={i} className={i ? "b" : undefined}>
                  {fmt(v)}
                  <span style={{ height: `${((v ?? 0) / max) * 110}px` }} />
                </div>
              ))}
            </div>
            {label}
          </div>
        ))}
      </div>
    </Card>
  );
}
