"use client";

import Link from "next/link";
import { FreeAgency, StartSit } from "@/components/Recs";
import { Card, Chevron, DayStepper, Empty, Photo, Source, Tag, useDay, usePageTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, lastName, monthDay, weekday } from "@/lib/format";
import type { Data } from "@/lib/types";
import { dayView, gameLine, marginWord, pastDay, scenarios, weekDays, type LineupRow, type PastRow } from "@/lib/view";

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

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Stakes data={data} />
      <div className="cols recs-first">
        <div className="stack">
          <section className="band today-band on-dark">
            <h1 className="band-title">{isToday ? "Your lineup tonight" : `Your lineup ${weekday(date)}`}</h1>
            <div className="total">
              <span className="num">{fmt(total)}</span>
              <span className="band-label">{n ? `Projected pts with ${n === 1 ? "the move" : `the ${n} moves`}` : "Projected pts"}</span>
            </div>
          </section>

          <div className="lineup-head">
            {stepper}
            <span className="note">As set on ESPN</span>
            <Source kind="proj">Proj. pts</Source>
          </div>

          <ul className="card rows" style={{ padding: "6px 14px", margin: 0, listStyle: "none" }} aria-label="Starters">
            {v.starters.map((r) => <Row key={r.player.id} r={r} when={when} />)}
          </ul>

          {v.bench.length > 0 && (
            <>
              <h2 className="section-label" style={{ marginTop: 6 }}>Bench</h2>
              <ul className="card rows" style={{ padding: "4px 14px", margin: 0, listStyle: "none" }} aria-label="Bench">
                {v.bench.map((r) => <Row key={r.player.id} r={r} when={when} />)}
              </ul>
            </>
          )}
        </div>

        <div className="stack">
          <h2 className="page-title">Recommendations</h2>
          <StartSit v={v} isToday={isToday} onJump={setDate} />
          <FreeAgency isToday={isToday} />
        </div>
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
    <div className="stack" style={{ gap: 18 }}>
      <Stakes data={data} />
      <div className="cols recs-first">
        <div className="stack">
          <section className="band today-band on-dark">
            <h1 className="band-title">Your lineup {day}</h1>
            <div className="total">
              <span className="num">{v.hasResults ? fmt(v.total) : "—"}</span>
              <span className="band-label">
                {!v.hasResults ? "Final scores aren’t in yet" : v.hasSlots ? "Pts scored by your starters" : "Pts scored by your roster, bench included"}
              </span>
            </div>
          </section>

          <div className="lineup-head">
            {stepper}
            <span className="note">
              {v.hasSlots ? "As set on ESPN" : "Final"}
              <span> · {v.played} of {v.starters.length} {v.hasSlots ? "starters played" : "played"}</span>
            </span>
            <Source kind="espn">Pts</Source>
          </div>

          <ul className="card rows" style={{ padding: "6px 14px", margin: 0, listStyle: "none" }} aria-label={v.hasSlots ? "Starters" : `Your roster, ${day}`}>
            {v.starters.map((r) => <PastRowItem key={r.player.id} r={r} />)}
          </ul>

          {v.bench.length > 0 && (
            <>
              <h2 className="section-label" style={{ marginTop: 6 }}>Bench</h2>
              <ul className="card rows" style={{ padding: "4px 14px", margin: 0, listStyle: "none" }} aria-label="Bench">
                {v.bench.map((r) => <PastRowItem key={r.player.id} r={r} />)}
              </ul>
            </>
          )}
        </div>

        <div className="stack">
          <h2 className="page-title">Recommendations</h2>
          <Card title="Start / sit">
            <p>{day}&rsquo;s games are over, so there&rsquo;s nothing left to set. These are the final points from ESPN.</p>
            <button className="next-moves" onClick={() => onJump(today)} style={{ marginTop: 12 }}>
              <span>
                <b>Back to today</b>
                <small>See tonight&rsquo;s lineup and moves</small>
              </span>
              <Chevron dir="right" />
            </button>
          </Card>
          <FreeAgency isToday={false} />
        </div>
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

/**
 * The week's stakes, first: where the matchup stands, and how the recommendations change the
 * projected finish (as set on ESPN → with the moves → with the top add too).
 */
function Stakes({ data }: { data: Data }) {
  const { players } = useData();
  const path = scenarios(data, players);
  if (!path || !data.opponent) return null;
  const m = data.matchup;
  const now = (m.my_score ?? 0) - (m.opponent_score ?? 0);
  const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
  const moves = path.find((x) => x.plan === "moves")!;
  const add = path.find((x) => x.plan === "add");
  const top = data.recommendations.pickups[0];
  const addName = top ? players.get(top.add_player_id)?.name : undefined;
  const headline =
    add && addName && moves.margin < 0 && add.margin > 0 ? `Add ${addName} and you’re projected to win.`
      : moves.margin > 0 ? `Projected to win by ${Math.round(moves.margin)}.`
        : `Projected to finish ${marginWord(moves.margin)}.`;
  return (
    <section className="stakes" aria-label="This week">
      <div className="stakes-head">
        <p className="stakes-now"><b>{cap(marginWord(now))}</b> vs {data.opponent.name} with {data.meta.matchup_days.length - Math.max(0, data.meta.matchup_days.indexOf(data.meta.today))} days left</p>
        <h2 className="stakes-title">{headline}</h2>
      </div>
      <ol className="path" aria-label="Projected finish">
        {path.map((x) => (
          <li key={x.plan} className={`step${x.margin > 0 ? " win" : ""}`}>
            <Link href={`/matchup${x.plan === "moves" ? "" : `?plan=${x.plan}`}`}>
              <small>{x.label}</small>
              <span className="num">{cap(marginWord(x.margin))}</span>
              {x.win != null && <span className="pct">{Math.round(x.win * 100)}% to win</span>}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Row({ r, when }: { r: LineupRow; when: string }) {
  const p = r.player;
  const dim = r.state === "idle" || r.state === "out";
  const line = r.game ? gameLine(p, r.game.date) : r.state === "out" ? `${p.nba_team} · Injured` : `${p.nba_team} · No game ${when}`;
  const m = r.replacedBy;
  return (
    <li className={`row${m ? " rec" : ""}${dim ? " dim" : ""}`}>
      <span className="slot" aria-label={`Slot ${r.slot}`}>{r.slot}</span>
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
