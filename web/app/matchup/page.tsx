"use client";

import { useState } from "react";
import { Card, DayStepper, Empty, Photo, Source, Tag } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, lastName, monthDay, weekday } from "@/lib/format";
import type { Player } from "@/lib/types";
import { gameLine, gamesByDay, lineupDays, sideDay } from "@/lib/view";

const fmt0 = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));

export default function MatchupPage() {
  const { data } = useData();
  const [picked, setPicked] = useState<string | null>(null);
  if (!data) return null;
  const m = data.matchup;
  const opp = data.opponent;
  if (m.is_bye || !opp) return <Empty>Bye week: no opponent this week.</Empty>;

  const proj = data.recommendations.matchup_projection ?? m.projected ?? null;
  const me = data.my_team;
  const today = data.meta.today;
  const weekDays = data.meta.matchup_days;
  const played = Math.max(0, weekDays.indexOf(today));
  const now = (m.my_score ?? 0) - (m.opponent_score ?? 0);
  const final = proj?.mine != null && proj?.opponent != null ? proj.mine - proj.opponent : null;
  const pWin = proj?.win_probability;
  const days = lineupDays(data);
  const date = picked && days.includes(picked) ? picked : days[0];
  const byDay = gamesByDay(data);
  const maxGames = Math.max(1, ...byDay.flatMap((d) => [d.mine, d.theirs]));
  const lead = (x: number) => (x === 0 ? "Tied" : x > 0 ? `Up ${fmt0(x)}` : `Down ${fmt0(-x)}`);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="score-band on-dark" aria-label="Score">
        <div className="teams">
          <Team init={initialsOf(me.name)} name={me.name} sub={`You · ${me.wins}–${me.losses}${me.standing ? ` · ${ordinal(me.standing)}` : ""}`} color="var(--accent)" />
          <span className="pill-week">Week {m.matchup_period} · {Math.max(0, weekDays.length - played)} days left</span>
          <Team init={initialsOf(opp.name)} name={opp.name} sub={`${opp.wins}–${opp.losses}${opp.standing ? ` · ${ordinal(opp.standing)}` : ""}`} color="var(--opp)" right />
        </div>
        <div className="score-row">
          <span className="num">{fmt0(m.my_score)}</span>
          <div className="mid">
            <Source kind="espn" />
            <b>Score now</b>
            <small>{lead(now)} · {played} of {weekDays.length} days played</small>
          </div>
          <span className="num r">{fmt0(m.opponent_score)}</span>
        </div>
        <div className="score-row">
          <span><span className="num proj-n" style={{ fontSize: 56 }}>{fmt0(proj?.mine)}</span><span className="unit">proj.</span></span>
          <div className="mid">
            <Source kind="proj" />
            <b>Projected final</b>
            <small>{final == null ? "" : `${lead(final)} · `}{pWin != null ? `${Math.round(pWin * 100)}% win probability` : ""}</small>
          </div>
          <span className="r"><span className="unit">proj.</span><span className="num proj-n" style={{ fontSize: 56 }}>{fmt0(proj?.opponent)}</span></span>
        </div>
        {[["You", m.my_score, proj?.mine, "var(--accent)"], [opp.name, m.opponent_score, proj?.opponent, "var(--opp)"]].map(([n, s, p, c]) => {
          const scale = Math.max(proj?.mine ?? 0, proj?.opponent ?? 0, 1) * 1.08;
          const sNow = (s as number) ?? 0, sProj = (p as number) ?? sNow;
          return (
            <div className="track-row" key={n as string}>
              <span>{n as string}</span>
              <div className="track" role="img" aria-label={`${fmt0(sNow)} scored, ${fmt0(sProj)} projected`}>
                <span style={{ width: `${(sNow / scale) * 100}%`, background: c as string }} />
                <span className="hatch" style={{ width: `${(Math.max(0, sProj - sNow) / scale) * 100}%`, ["--c" as string]: c as string }} />
              </div>
              <small>{fmt0(sNow)} now &rarr; {fmt0(sProj)} proj.</small>
            </div>
          );
        })}
      </section>

      <Card
        title="Games left by day"
        aside={<span className="legend"><span><i style={{ background: "var(--accent)" }} />You</span><span><i style={{ background: "var(--opp)" }} />{opp.name}</span></span>}
      >
        <div className="day-bars">
          {byDay.map((d) => (
            <button
              key={d.date}
              className={`day-bar${d.date === date ? " on" : ""}`}
              onClick={() => setPicked(d.date)}
              aria-pressed={d.date === date}
              style={{ border: 0, background: d.date === date ? undefined : "none", font: "inherit", cursor: "pointer", textAlign: "inherit" }}
            >
              <span className="side l">
                <span className="num" style={{ color: "var(--accent)" }}>{d.mine}</span>
                <span style={{ width: `${(d.mine / maxGames) * 100}%`, background: "var(--accent)" }} />
              </span>
              <span className="mid">
                <b>{d.date === today ? "Today" : weekday(d.date)}</b>
                <small>{dayShort(d.date)}</small>
              </span>
              <span className="side">
                <span style={{ width: `${(d.theirs / maxGames) * 100}%`, background: "var(--opp)" }} />
                <span className="num" style={{ color: "var(--opp)" }}>{d.theirs}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <DayStepper days={days} value={date} onChange={setPicked} today={today}
          label={(d) => ({ day: weekday(d), date: d === today ? dayShort(d) : monthDay(d) })} />
      </div>

      <div className="rosters">
        <Side title="You" color="var(--accent)" date={date} mine />
        <Side title={opp.name} color="var(--opp)" date={date} />
      </div>
    </div>
  );
}

function Side({ title, color, date, mine = false }: { title: string; color: string; date: string; mine?: boolean }) {
  const { data, players } = useData();
  if (!data) return null;
  const s = sideDay(data, players, date, mine);
  const when = date === data.meta.today ? "today" : weekday(date);
  const offText = (p: Player) => (p.injury_status === "OUT" ? `${lastName(p.name)} (out)` : lastName(p.name));
  return (
    <section className="card rows" style={{ padding: "18px 24px 8px" }}>
      <div className="roster-head">
        <span className="dot" style={{ background: color }} />
        <b>{title}</b>
        <span className="muted">· {s.rows.length} playing {when}</span>
        <span className="grow" />
        <span className="section-label">Proj. pts {when}</span>
      </div>
      {s.rows.length === 0 && <Empty>Nobody plays {when}.</Empty>}
      {s.rows.map(({ player: p, value }) => (
        <div className="row" key={p.id} style={{ padding: "8px 0" }}>
          <Photo p={p} size={40} round />
          <div className="who">
            <div className="who-top">
              <strong>{p.name}</strong>
              {p.injury_status === "DAY_TO_DAY" && <Tag tone="warn">Day-to-day</Tag>}
            </div>
            <small>{gameLine(p, date) ?? p.nba_team}</small>
          </div>
          {value == null ? <Tag tone="ink">Live</Tag> : <span className="num" style={{ fontSize: 24 }}>{fmt(value)}</span>}
        </div>
      ))}
      <div className="total-row">
        Total {when}
        <span className="num">{fmt(s.total)}</span>
      </div>
      {s.off.length > 0 && (
        <p className="off"><b>Not playing {when}:</b> {s.off.map(offText).join(", ")}</p>
      )}
    </section>
  );
}

function Team({ init, name, sub, color, right }: { init: string; name: string; sub: string; color: string; right?: boolean }) {
  return (
    <div className={`team${right ? " right" : ""}`}>
      <span className="avatar" style={{ background: color }}>{init}</span>
      <div>
        <b>{name}</b>
        <small>{sub}</small>
      </div>
    </div>
  );
}

const initialsOf = (name: string) => name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] ?? "th"}`;
