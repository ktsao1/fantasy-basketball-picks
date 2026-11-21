"use client";

import { DayStepper, Empty, Photo, Tag, useDay, usePageTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, monthDay, signed, weekday } from "@/lib/format";
import { dayView, gameLine, pastDay, scenarios, scoreThroughDate, sideDay, weekDays as allDays } from "@/lib/view";

const fmt0 = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));

export default function MatchupPage() {
  usePageTitle("Matchup");
  const { data, players, actuals, lineups } = useData();
  const days = data ? allDays(data) : [];
  const [picked, setPicked] = useDay(days, data?.meta.today);
  if (!data) return null;
  const m = data.matchup;
  const opp = data.opponent;
  if (m.is_bye || !opp) return <Empty>Bye week: no opponent this week.</Empty>;

  const proj = data.recommendations.matchup_projection ?? m.projected ?? null;
  const me = data.my_team;
  const today = data.meta.today;
  // The engine's projection: the rest of the week with the recommended moves.
  const moves = scenarios(data, players)?.find((x) => x.plan === "moves");
  const mineFinal = moves?.mine ?? proj?.mine ?? null;
  const oppFinal = proj?.opponent ?? null;
  const pWin = moves?.win ?? proj?.win_probability ?? null;
  if (!picked) return <Empty>No games this week.</Empty>;
  const date = picked;
  const past = date < today;
  const future = date > today;
  const score = scoreThroughDate(data, players, actuals, lineups, date);
  const hasStarted = !past && !future && data.players.some((player) => player.game_today_locked);
  const status = past ? (actuals[date] ? "Final" : "Awaiting results") : hasStarted ? "Live / projected" : "Projected";
  const margin = score.mine == null || score.opponent == null ? null : score.mine - score.opponent;
  const lead = (x: number) => (x === 0 ? "Tied" : x > 0 ? `Up ${fmt0(x)}` : `Down ${fmt0(-x)}`);
  const projectedMargin = mineFinal == null || oppFinal == null ? null : Math.round(mineFinal) - Math.round(oppFinal);
  const verdict =
    projectedMargin == null ? null
      : projectedMargin === 0 ? "Projected tie"
        : `${projectedMargin > 0 ? "You’re" : `${opp.name} is`} projected to win by ${fmt0(Math.abs(projectedMargin))}`;
  const youPct = pWin != null ? Math.round(pWin * 100) : null;
  const pointShare = mineFinal != null && oppFinal != null && mineFinal >= 0 && oppFinal >= 0 && mineFinal + oppFinal > 0
    ? (100 * mineFinal) / (mineFinal + oppFinal)
    : null;
  const roundedShare = Math.round((pointShare ?? 0) * 10) / 10;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h1 className="sr-only">Matchup</h1>
      <section className="score-band on-dark" aria-label="Score">
        <div className="teams">
          <Team init="YT" name="Your Team" sub={`${me.wins}–${me.losses}${me.standing ? ` · ${ordinal(me.standing)}` : ""}`} color="var(--accent-on-dark)" />
          <span className="pill-week">Week {m.matchup_period} · {days.length - score.through + Number(date === today)} days left</span>
          <Team init={initialsOf(opp.name)} name={opp.name} sub={`${opp.wins}–${opp.losses}${opp.standing ? ` · ${ordinal(opp.standing)}` : ""}`} color="var(--opp-on-dark)" right />
        </div>

        <div className={`score-row${future ? " score-projected" : ""}`} aria-live="polite">
          <span className="num">{fmt0(score.mine)}</span>
          <div className="mid">
            {!future && <span className="src src-espn src-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- a 16px local mark */}
              <img src="/img/espn.png" alt="" width={16} height={16} />
              ESPN
            </span>}
            <b>{future ? "Projected through" : past ? "Score through" : "Score now"}{date !== today && ` ${weekday(date)}`}</b>
            <small>{margin == null ? "Score unavailable" : lead(margin)} · Day {score.through} of {days.length}</small>
          </div>
          <span className="num r">{fmt0(score.opponent)}</span>
        </div>

        {!past && <div className="proj-row">
          <span className="proj-total"><span className="num">{fmt0(mineFinal)}</span> proj. total</span>
          <div className="proj-verdict">
            {verdict && <h2 className="verdict-line">{verdict}</h2>}
            {youPct != null && <p>Win chance · You {youPct}% · {opp.name} {100 - youPct}%</p>}
          </div>
          <span className="proj-total r">proj. total <span className="num">{fmt0(oppFinal)}</span></span>
        </div>}

        {!past && pointShare != null && (
          <div className="point-share">
            <div className="point-share-bar" role="img" aria-label={`Projected point share: you ${fmt(roundedShare)}%, ${opp.name} ${fmt(100 - roundedShare)}%`}>
              {pointShare > 0 && <span style={{ flexGrow: pointShare, background: "var(--accent-on-dark)" }} />}
              {pointShare < 100 && <span style={{ flexGrow: 100 - pointShare, background: "var(--opp-on-dark)" }} />}
            </div>
            <div className="point-share-labels" aria-hidden>
              <span>{fmt(roundedShare)}%</span>
              <span>Projected point share</span>
              <span>{fmt(100 - roundedShare)}%</span>
            </div>
          </div>
        )}
      </section>

      <div className="matchup-date">
        <DayStepper days={days} value={date} onChange={setPicked} today={today}
          label={(d) => ({ day: weekday(d), date: d === today ? dayShort(d) : monthDay(d) })}
          status={status} />
        {!past && <p className="matchup-assumption">Projections use recommended starters on both teams.</p>}
      </div>

      <div className="rosters">
        {date < today ? (
          <>
            <PastSide title="You" color="var(--accent)" date={date} mine />
            <PastSide title={opp.name} color="var(--opp)" date={date} />
          </>
        ) : (
          <>
            <Side title="You" color="var(--accent)" date={date} mine />
            <Side title={opp.name} color="var(--opp)" date={date} />
          </>
        )}
      </div>
    </div>
  );
}

/** A finished day for one team: final points from ESPN's box scores. */
function PastSide({ title, color, date, mine = false }: { title: string; color: string; date: string; mine?: boolean }) {
  const { data, players, actuals, lineups } = useData();
  if (!data) return null;
  const s = pastDay(mine ? data.my_team : data.opponent, players, actuals, lineups, date);
  const them = mine ? pastDay(data.opponent, players, actuals, lineups, date) : null;
  const played = s.starters.filter((r) => r.played);
  return (
    <section className="card rows" style={{ padding: "18px 24px 8px" }} aria-label={`${title}, ${weekday(date)}`}>
      <div className="roster-head">
        <span className="dot" style={{ background: color }} />
        <b>{title}</b>
        <span className="grow" />
        <span className="section-label">Final pts</span>
      </div>
      {!s.hasSlots && <p className="side-note">Everyone who played, bench included: this day&rsquo;s lineup wasn&rsquo;t saved.</p>}
      {!s.hasResults && <Empty>Final scores for {weekday(date)} aren&rsquo;t in yet.</Empty>}
      {s.hasResults && played.length === 0 && <Empty>Nobody played {weekday(date)}.</Empty>}
      {s.hasResults && played.map(({ player: p, scored, slot, line }) => (
        <div className="row" key={p.id} style={{ padding: "8px 0" }}>
          {slot && <span className="slot" aria-label={`Slot ${slot}`}>{slot}</span>}
          <Photo p={p} size={40} round />
          <div className="who">
            <div className="who-top"><strong>{p.name}</strong></div>
            <small>{line}</small>
          </div>
          <div className="proj">
            <span className="num" style={{ fontSize: 24 }}>{fmt(scored)}</span>
          </div>
        </div>
      ))}
      {s.hasResults && (
        <div className="total-row">
          Total
          {them?.hasResults && (
            <span className={`edge ${s.total - them.total >= 0 ? "up" : "down"}`}>
              {signed(s.total - them.total)} vs them
            </span>
          )}
          <span className="num">{fmt(s.total)}</span>
        </div>
      )}
      {s.hasSlots && s.hasResults && <SittingOut names={[...s.starters.filter((r) => !r.played), ...s.bench].map((r) => r.player.name)} />}
    </section>
  );
}

function Side({ title, color, date, mine = false }: { title: string; color: string; date: string; mine?: boolean }) {
  const { data, players } = useData();
  if (!data) return null;
  const v = mine ? dayView(data, players, date) : null;
  const s = sideDay(data, players, date, mine);
  const theirs = mine ? sideDay(data, players, date, false) : null;
  const when = date === data.meta.today ? "today" : weekday(date);
  const moves = v?.moves.length ?? 0;
  const hasStarted = s.rows.some((row) => row.started);
  return (
    <section className="card rows" style={{ padding: "18px 24px 8px" }} aria-label={`${title}, ${when}`}>
      <div className="roster-head">
        <span className="dot" style={{ background: color }} />
        <b>{title}</b>
      </div>
      {mine && v && moves > 0 && (
        <p className="side-note">
          With your {moves === 1 ? "recommended move" : `${moves} recommended moves`} ({fmt(v.asSet)} as set on ESPN).
        </p>
      )}
      {!s.available && <Empty>Their daily lineup isn&rsquo;t in this snapshot.</Empty>}
      {s.available && s.rows.length === 0 && <Empty>Nobody plays {when}.</Empty>}
      {s.rows.map(({ player: p, value, scored, started }) => (
        <div className="row" key={p.id} style={{ padding: "8px 0" }}>
          <Photo p={p} size={40} round />
          <div className="who">
            <div className="who-top">
              <strong>{p.name}</strong>
              {p.injury_status === "DAY_TO_DAY" && <Tag tone="warn">Day-to-day</Tag>}
            </div>
            <small>{gameLine(p, date) ?? p.nba_team}</small>
          </div>
          <div className={`proj ${started ? "match-actual" : "match-projected"}`}>
            <span className="num" style={{ fontSize: 24 }}>{fmt(value ?? scored)}</span>
            {hasStarted && <small>{started ? "Scored" : "Proj."}</small>}
          </div>
        </div>
      ))}
      {s.available && (
        <div className="total-row">
          {hasStarted ? "Est. total" : "Total"}
          {theirs?.available && (
            <span className={`edge ${s.total - theirs.total >= 0 ? "up" : "down"}`}>
              {signed(s.total - theirs.total)} vs them
            </span>
          )}
          <span className="num">{fmt(s.total)}</span>
        </div>
      )}
      {s.available && <SittingOut names={s.off.map((p) => p.name)} />}
    </section>
  );
}

function SittingOut({ names }: { names: string[] }) {
  return names.length ? <p className="match-off"><strong>Sitting out</strong> {names.join(", ")}</p> : null;
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
