"use client";

import { useState } from "react";
import { FreeAgency, StartSit } from "@/components/Recs";
import { DayStepper, Empty, Photo, Source, Tag } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, lastName, monthDay, tip, weekday } from "@/lib/format";
import { dayView, gameLine, lineupDays, type LineupRow } from "@/lib/view";

export default function TodayPage() {
  const { data, players } = useData();
  const [picked, setPicked] = useState<string | null>(null);
  if (!data) return null;
  const days = lineupDays(data);
  if (days.length === 0) return <Empty>No games left for your players this week.</Empty>;

  const date = picked && days.includes(picked) ? picked : days[0];
  const today = data.meta.today;
  const isToday = date === today;
  const v = dayView(data, players, date);
  const n = v.moves.length;
  const slots = data.recommendations.lineup.filter((l) => l.date === date).length;
  const firstTip = v.starters.map((r) => r.game).filter((g) => g && !g.started && g.start_utc).map((g) => g!.start_utc!).sort()[0];
  const when = isToday ? "today" : weekday(date);

  const sub = [
    n ? `Only ${v.playingAsSet} of ${slots} starters play as set on ESPN` : `${v.playing} of ${slots} starters play`,
    v.liveCount ? `${v.liveCount} in progress` : firstTip ? `first tip ${tip(firstTip)}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="cols">
      <div className="stack">
        <section className="band today-band on-dark">
          <div>
            <h1 className="band-title">{isToday ? "Your lineup tonight" : `Your lineup ${weekday(date)}`}</h1>
            <p className="band-sub">{sub}</p>
          </div>
          <div className="total">
            <span className="num">{fmt(n ? v.withMoves : v.asSet)}</span>
            <span className="band-label">{n ? `Projected with ${n} move${n === 1 ? "" : "s"}` : `Projected pts ${isToday ? "tonight" : weekday(date)}`}</span>
            {n > 0 && <p className="band-sub" style={{ marginTop: 2 }}>{fmt(v.asSet)} projected as set on ESPN</p>}
          </div>
        </section>

        <div className="lineup-head">
          <DayStepper days={days} value={date} onChange={setPicked} today={today}
            label={(d) => ({ day: weekday(d), date: d === today ? dayShort(d) : monthDay(d) })} />
          <Source kind="espn" />
          <span className="note">Lineup as set on ESPN <span>· {n ? `${n} recommended move${n === 1 ? "" : "s"}` : "matches our recommendation"}</span></span>
          <Source kind="proj">Proj. pts</Source>
        </div>

        <section className="card rows" style={{ padding: "6px 14px" }} aria-label="Starters">
          {v.starters.map((r) => <Row key={r.player.id} r={r} when={when} />)}
        </section>

        {v.bench.length > 0 && (
          <>
            <p className="section-label" style={{ marginTop: 6 }}>Bench</p>
            <section className="card rows" style={{ padding: "4px 14px" }} aria-label="Bench">
              {v.bench.map((r) => <Row key={r.player.id} r={r} when={when} />)}
            </section>
          </>
        )}
      </div>

      <div className="stack">
        <h2 className="page-title">Recommendations</h2>
        <StartSit v={v} isToday={isToday} />
        <FreeAgency />
      </div>
    </div>
  );
}

function Row({ r, when }: { r: LineupRow; when: string }) {
  const p = r.player;
  const dim = r.state === "idle" || r.state === "out";
  const line = r.game ? gameLine(p, r.game.date) : r.state === "out" ? `${p.nba_team} · Injured` : `${p.nba_team} · No game ${when}`;
  const m = r.replacedBy;
  return (
    <div className={`row${m ? " rec" : ""}${dim ? " dim" : ""}`}>
      <span className="slot">{r.slot}</span>
      <Photo p={p} size={40} round dim={dim} />
      <div className="who">
        <div className="who-top">
          <strong>{p.name}</strong>
          {r.state === "out" && <Tag tone="neg">Out</Tag>}
          {r.state !== "out" && p.injury_status === "DAY_TO_DAY" && <Tag tone="warn">Day-to-day</Tag>}
          {r.startAt && <Tag tone="rec">Start at {r.startAt}</Tag>}
          {r.state === "live" && <Tag tone="ink">Live</Tag>}
        </div>
        <small>{line}</small>
      </div>
      {m ? (
        <span className="rec-chip">
          <Photo p={m.start} size={26} round />
          <span>
            <b>Start {lastName(m.start.name)}</b>
            <small>{fmt(m.value)} proj.{m.lock ? ` · ${m.lock}` : ""}</small>
          </span>
        </span>
      ) : r.value != null ? (
        <div className="proj">
          <span className="num">{fmt(r.value)}</span>
          <small>proj. pts</small>
        </div>
      ) : null}
    </div>
  );
}
