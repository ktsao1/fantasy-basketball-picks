"use client";

import Link from "next/link";
import { FreeAgency, StartSit } from "@/components/Recs";
import { Photo, Tag, usePageTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { fmt, lastName } from "@/lib/format";
import type { Data } from "@/lib/types";
import { dayView, gameLine, marginWord, weekDays, type LineupRow } from "@/lib/view";

export default function TodayPage() {
  usePageTitle("Today");
  const { data, players } = useData();
  if (!data) return null;

  const v = dayView(data, players, data.meta.today);
  const n = v.moves.length;
  const total = (n ? v.withMoves : v.asSet) + v.liveScored;
  const totalLabel = v.liveCount ? "Estimated lineup points" : "Projected lineup points";
  const pickup = data.recommendations.pickups[0];
  const add = pickup && players.get(pickup.add_player_id);
  const renderRow = (r: LineupRow) => (
    <Row key={r.player.id} r={r}
      dropFor={add && pickup.drop_player_id === r.player.id ? lastName(add.name) : undefined} />
  );

  return (
    <div className="today-layout">
      <section className="band today-band on-dark">
        <div className="today-band-copy">
          <h1 className="band-title">Your lineup tonight</h1>
          <MatchupContext data={data} />
        </div>
        <div className="total">
          <span className="num">{fmt(total)}</span>
          <span className="band-label">{n ? `${totalLabel} with ${n === 1 ? "1 move" : `${n} moves`}` : totalLabel}</span>
        </div>
      </section>

      <div className="stack today-recs">
        <div className="stack today-start">
          <h2 className="section-label">Recommendations</h2>
          <StartSit v={v} />
        </div>
        <div className="today-agency"><FreeAgency /></div>
      </div>

      <div className="stack today-lineup">
        <div className="lineup-head">
          <h2 className="section-label grow">Starters <small className="lineup-source">As set on ESPN</small></h2>
        </div>

        <ul className="card rows" style={{ padding: "6px 14px", margin: 0, listStyle: "none" }} aria-label="Starters">
          {v.starters.map(renderRow)}
        </ul>

        {v.bench.length > 0 && (
          <>
            <h2 className="section-label" style={{ marginTop: 6 }}>Bench</h2>
            <ul className="card rows" style={{ padding: "4px 14px", margin: 0, listStyle: "none" }} aria-label="Bench">
              {v.bench.map(renderRow)}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function MatchupContext({ data }: { data: Data }) {
  if (!data.opponent || data.matchup.is_bye) return null;
  const { my_score: mine, opponent_score: theirs } = data.matchup;
  const daysLeft = weekDays(data).filter((day) => day >= data.meta.today).length;
  const margin = mine == null || theirs == null ? null : marginWord(mine - theirs);
  return (
    <>
      {margin && (
        <p className="today-margin"><b className={margin.startsWith("down") ? "behind" : undefined}>{margin[0].toUpperCase() + margin.slice(1)}</b> vs {data.opponent.name} with {daysLeft} {daysLeft === 1 ? "day" : "days"} left</p>
      )}
      <Link className="today-matchup-link" href="/matchup">View matchup <span aria-hidden>→</span></Link>
    </>
  );
}

function Row({ r, dropFor }: { r: LineupRow; dropFor?: string }) {
  const p = r.player;
  const dim = r.state === "idle" || r.state === "out";
  const line = r.game ? gameLine(p, r.game.date) : r.state === "out" ? `${p.nba_team} · Injured` : `${p.nba_team} · No game today`;
  const m = r.replacedBy;
  return (
    <li className={`row${m || dropFor ? " rec" : ""}${dim ? " dim" : ""}`}>
      <span className="slot" aria-label={`Slot ${r.slot}`}>{r.slot}</span>
      <Photo p={p} size={40} round dim={dim} />
      <div className="who">
        <div className="who-top">
          <strong>{p.name}</strong>
          {r.state === "out" && <Tag tone="neg">Out</Tag>}
          {r.state !== "out" && p.injury_status === "DAY_TO_DAY" && <Tag tone="warn">Day-to-day</Tag>}
          {r.startAt && <Tag tone="rec">Start at {r.startAt}</Tag>}
          {dropFor && <Tag tone="rec">Drop for {dropFor}</Tag>}
          {r.state === "live" && <Tag tone="ink">Live</Tag>}
        </div>
        <small>{line}</small>
      </div>
      {m ? (
        <span className="rec-chip">
          <Photo p={m.start} size={26} round />
          <span>
            <b>Start {lastName(m.start.name)}</b>
            <small>{fmt(m.value)} proj.</small>
          </span>
        </span>
      ) : r.state === "live" ? (
        <div className="proj scored">
          <span className="num">{fmt(r.scored)}</span>
          <small>pts so far</small>
        </div>
      ) : r.value != null ? (
        <div className="proj">
          <span className="num">{fmt(r.value)}</span>
        </div>
      ) : null}
    </li>
  );
}
