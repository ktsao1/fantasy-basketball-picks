"use client";

import Link from "next/link";
import { FreeAgency, StartSit } from "@/components/Recs";
import { Card, Chevron, DayStepper, Empty, Photo, Source, Tag, useDay, usePageTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, lastName, monthDay, weekday } from "@/lib/format";
import type { Data } from "@/lib/types";
import { dayView, gameLine, marginWord, pastDay, weekDays, type LineupRow, type PastRow } from "@/lib/view";

export default function TodayPage() {
  usePageTitle("Today");
  const { data, players } = useData();
  const days = data ? weekDays(data) : [];
  const [date, setDate] = useDay(days, data?.meta.today);
  if (!data) return null;
  if (!date) return <Empty>No games for your players this week.</Empty>;

  const today = data.meta.today;
  const stepper = (
    <DayStepper days={days} value={date} onChange={setDate} today={today}
      label={(d) => ({ day: weekday(d), date: d === today ? dayShort(d) : monthDay(d) })} />
  );
  if (date < today) return <PastDayView date={date} today={today} stepper={stepper} onJump={setDate} />;

  const isToday = date === today;
  const v = dayView(data, players, date);
  const n = v.moves.length;
  const when = isToday ? "today" : weekday(date);
  const total = (n ? v.withMoves : v.asSet) + v.liveScored;
  const totalLabel = v.liveCount ? "Estimated lineup points" : "Projected lineup points";
  const pickup = data.recommendations.pickups[0];
  const add = pickup && players.get(pickup.add_player_id);
  const renderRow = (r: LineupRow) => (
    <Row key={r.player.id} r={r} when={when}
      dropFor={isToday && add && pickup.drop_player_id === r.player.id ? lastName(add.name) : undefined} />
  );

  return (
    <div className="today-layout">
      <div className="today-date">{stepper}</div>
      <section className="band today-band on-dark">
        <div className="today-band-copy">
          <h1 className="band-title">{isToday ? "Your lineup tonight" : `Your lineup ${weekday(date)}`}</h1>
          <MatchupContext data={data} date={date} />
        </div>
        <div className="total">
          <span className="num">{fmt(total)}</span>
          <span className="band-label">{n ? `${totalLabel} with ${n === 1 ? "1 move" : `${n} moves`}` : totalLabel}</span>
        </div>
      </section>

      <div className="stack today-recs">
        <div className="stack today-start">
          <h2 className="section-label">Recommendations</h2>
          <StartSit v={v} isToday={isToday} onJump={setDate} />
        </div>
        <div className="today-agency"><FreeAgency isToday={isToday} /></div>
      </div>

      <div className="stack today-lineup">
        <div className="lineup-head">
          <h2 className="section-label grow">Starters <small className="lineup-source">As set on ESPN</small></h2>
          <Source kind="proj">{v.liveCount ? "Scored / proj. pts" : "Proj. pts"}</Source>
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

/** A finished day: what each of your players scored, from ESPN's box scores. No recommendations. */
function PastDayView({ date, today, stepper, onJump }: { date: string; today: string; stepper: React.ReactNode; onJump: (d: string) => void }) {
  const { data, players, actuals, lineups } = useData();
  if (!data) return null;
  const v = pastDay(data.my_team, players, actuals, lineups, date);
  const day = weekday(date);
  return (
    <div className="today-layout">
      <div className="today-date">{stepper}</div>
      <section className="band today-band on-dark">
        <div className="today-band-copy">
          <h1 className="band-title">Your lineup {day}</h1>
          <MatchupContext data={data} date={date} />
        </div>
        <div className="total">
          <span className="num">{v.hasResults ? fmt(v.total) : "—"}</span>
          <span className="band-label">
            {!v.hasResults ? "Final scores aren’t in yet" : v.hasSlots ? "Pts scored by your starters" : "Pts scored by your roster, bench included"}
          </span>
        </div>
      </section>

      <div className="stack today-recs">
        <div className="stack today-start">
          <h2 className="section-label">Recommendations</h2>
          <Card title="Start / sit">
            <p>Lineup changes for {day} are closed.</p>
            <button className="next-moves" onClick={() => onJump(today)}>
              <span>
                <b>Back to today</b>
                <small>See tonight&rsquo;s lineup and moves</small>
              </span>
              <Chevron dir="right" />
            </button>
          </Card>
        </div>
        <div className="today-agency"><FreeAgency isToday={false} /></div>
      </div>

      <div className="stack today-lineup">
        <div className="lineup-head">
          <span className="note">
            {v.hasSlots ? "As set on ESPN" : "Final"}
            <span> · {v.played} of {v.starters.length} {v.hasSlots ? "starters played" : "played"}</span>
          </span>
          <Source kind="espn">Pts</Source>
        </div>

        {v.hasResults ? (
          <ul className="card rows" style={{ padding: "6px 14px", margin: 0, listStyle: "none" }} aria-label={v.hasSlots ? "Starters" : `Your roster, ${day}`}>
            {v.starters.map((r) => <PastRowItem key={r.player.id} r={r} />)}
          </ul>
        ) : <Card><Empty>ESPN’s final scores for {day} are unavailable.</Empty></Card>}

        {v.hasResults && v.bench.length > 0 && (
          <>
            <h2 className="section-label" style={{ marginTop: 6 }}>Bench</h2>
            <ul className="card rows" style={{ padding: "4px 14px", margin: 0, listStyle: "none" }} aria-label="Bench">
              {v.bench.map((r) => <PastRowItem key={r.player.id} r={r} />)}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function PastRowItem({ r }: { r: PastRow }) {
  const p = r.player;
  return (
    <li className={`row${r.played ? "" : " dim"}`}>
      {r.slot && <span className="slot" aria-label={`Slot ${r.slot}`}>{r.slot}</span>}
      <Photo p={p} size={40} round dim={!r.played} />
      <div className="who">
        <div className="who-top"><strong>{p.name}</strong></div>
        <small>{r.line}</small>
      </div>
      {r.played && (
        <div className="proj">
          <span className="num">{fmt(r.scored)}</span>
        </div>
      )}
    </li>
  );
}

function MatchupContext({ data, date }: { data: Data; date: string }) {
  if (!data.opponent || data.matchup.is_bye) return null;
  const { my_score: mine, opponent_score: theirs } = data.matchup;
  const daysLeft = weekDays(data).filter((day) => day >= data.meta.today).length;
  const margin = mine == null || theirs == null ? null : marginWord(mine - theirs);
  return (
    <>
      {date === data.meta.today && margin && (
        <p className="today-margin"><b className={margin.startsWith("down") ? "behind" : undefined}>{margin[0].toUpperCase() + margin.slice(1)}</b> vs {data.opponent.name} with {daysLeft} {daysLeft === 1 ? "day" : "days"} left</p>
      )}
      <Link className="today-matchup-link" href={date === data.meta.today ? "/matchup" : `/matchup?day=${date}`}>View matchup <span aria-hidden>→</span></Link>
    </>
  );
}

function Row({ r, when, dropFor }: { r: LineupRow; when: string; dropFor?: string }) {
  const p = r.player;
  const dim = r.state === "idle" || r.state === "out";
  const line = r.game ? gameLine(p, r.game.date) : r.state === "out" ? `${p.nba_team} · Injured` : `${p.nba_team} · No game ${when}`;
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
