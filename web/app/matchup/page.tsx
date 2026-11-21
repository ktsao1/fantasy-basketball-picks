"use client";

import { DayStepper, Empty, Photo, Tag, useDay, usePageTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, monthDay, signed, weekday } from "@/lib/format";
import { dayView, gameLine, pastDay, scenarios, sideDay, weekDays as allDays } from "@/lib/view";

const fmt0 = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));

export default function MatchupPage() {
  usePageTitle("Matchup");
  const { data, players } = useData();
  const days = data ? allDays(data) : [];
  const [picked, setPicked] = useDay(days, data?.meta.today);
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
  // The engine's projection: the rest of the week with the recommended moves.
  const moves = scenarios(data, players)?.find((x) => x.plan === "moves");
  const mineFinal = moves?.mine ?? proj?.mine ?? null;
  const oppFinal = proj?.opponent ?? null;
  const pWin = moves?.win ?? proj?.win_probability ?? null;
  if (!picked) return <Empty>No games this week.</Empty>;
  const date = picked;
  const lead = (x: number) => (x === 0 ? "Tied" : x > 0 ? `Up ${fmt0(x)}` : `Down ${fmt0(-x)}`);
  const verdict =
    mineFinal == null || oppFinal == null ? null
      : Math.round(mineFinal) === Math.round(oppFinal) ? "Projected to tie"
        : mineFinal > oppFinal ? "You’re projected to win" : `${opp.name} is projected to win`;
  const youPct = pWin != null ? Math.round(pWin * 100) : null;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="score-band on-dark" aria-label="Score">
        <div className="teams">
          <Team init={initialsOf(me.name)} name={me.name} sub={`You · ${me.wins}–${me.losses}${me.standing ? ` · ${ordinal(me.standing)}` : ""}`} color="var(--accent-on-dark)" />
          <span className="pill-week">Week {m.matchup_period} · {Math.max(0, weekDays.length - played)} days left</span>
          <Team init={initialsOf(opp.name)} name={opp.name} sub={`${opp.wins}–${opp.losses}${opp.standing ? ` · ${ordinal(opp.standing)}` : ""}`} color="var(--opp-on-dark)" right />
        </div>

        <div className="score-row">
          <span className="num">{fmt0(m.my_score)}</span>
          <div className="mid">
            <span className="src src-espn src-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- a 16px local mark */}
              <img src="/img/espn.png" alt="" width={16} height={16} />
              ESPN
            </span>
            <b>Current score</b>
            <small>{lead(now)} · {played} of {weekDays.length} days played</small>
          </div>
          <span className="num r">{fmt0(m.opponent_score)}</span>
        </div>

        <div className="proj-row">
          <span className="proj-total"><span className="num">{fmt0(mineFinal)}</span> proj. total</span>
          {verdict && <h1 className="verdict-line">{verdict}</h1>}
          <span className="proj-total r">proj. total <span className="num">{fmt0(oppFinal)}</span></span>
        </div>

        {youPct != null && (
          <div className="win-odds">
            <div className="win-bar" role="img" aria-label={`${youPct}% chance you win, ${100 - youPct}% ${opp.name}`}>
              <span style={{ flexGrow: youPct, background: "var(--accent-on-dark)" }} />
              <span style={{ flexGrow: 100 - youPct, background: "var(--opp-on-dark)" }} />
            </div>
            <div className="win-labels" aria-hidden>
              <span>{youPct}% you win</span>
              <span>{100 - youPct}% {opp.name} wins</span>
            </div>
          </div>
        )}
      </section>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <DayStepper days={days} value={date} onChange={setPicked} today={today}
          label={(d) => ({ day: weekday(d), date: d === today ? dayShort(d) : monthDay(d) })} />
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
  return (
    <section className="card rows" style={{ padding: "18px 24px 8px" }} aria-label={`${title}, ${when}`}>
      <div className="roster-head">
        <span className="dot" style={{ background: color }} />
        <b>{title}</b>
        <span className="grow" />
        <span className="section-label">Proj. pts</span>
      </div>
      {mine && v && moves > 0 && (
        <p className="side-note">
          With your {moves === 1 ? "recommended move" : `${moves} recommended moves`} ({fmt(v.asSet)} as set on ESPN).
        </p>
      )}
      {!s.available && <Empty>Their daily lineup isn&rsquo;t in this snapshot.</Empty>}
      {s.available && s.rows.length === 0 && <Empty>Nobody plays {when}.</Empty>}
      {s.rows.map(({ player: p, value, scored }) => (
        <div className="row" key={p.id} style={{ padding: "8px 0" }}>
          <Photo p={p} size={40} round />
          <div className="who">
            <div className="who-top">
              <strong>{p.name}</strong>
              {p.injury_status === "DAY_TO_DAY" && <Tag tone="warn">Day-to-day</Tag>}
              {value == null && <Tag tone="ink">Live</Tag>}
            </div>
            <small>{gameLine(p, date) ?? p.nba_team}</small>
          </div>
          <div className="proj">
            <span className="num" style={{ fontSize: 24 }}>{fmt(value ?? scored)}</span>
            {value == null && <small style={{ color: "var(--ink)", fontWeight: 600 }}>so far</small>}
          </div>
        </div>
      ))}
      {s.available && (
        <div className="total-row">
          Total
          {theirs?.available && (
            <span className={`edge ${s.total - theirs.total >= 0 ? "up" : "down"}`}>
              {signed(s.total - theirs.total)} vs them
            </span>
          )}
          <span className="num">{fmt(s.total)}</span>
        </div>
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
