"use client";

import { DayStepper, Empty, Photo, Tag, useDay, usePageTitle, useQueryState } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, lastName, monthDay, signed, weekday } from "@/lib/format";
import { dayView, gameLine, pastDay, scenarios, sideDay, weekDays as allDays, type Plan } from "@/lib/view";

const PLANS = ["moves", "as-set", "add"] as const;

const fmt0 = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));

export default function MatchupPage() {
  usePageTitle("Matchup");
  const { data, players } = useData();
  const days = data ? allDays(data) : [];
  const [picked, setPicked] = useDay(days, data?.meta.today);
  const [plan, setPlan] = useQueryState<Plan>("plan", "moves", PLANS);
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
  const path = scenarios(data, players) ?? [];
  const sc = path.find((x) => x.plan === plan) ?? path.find((x) => x.plan === "moves");
  const mineFinal = sc?.mine ?? proj?.mine ?? null;
  const final = mineFinal != null && proj?.opponent != null ? mineFinal - proj.opponent : null;
  const pWin = sc?.win ?? proj?.win_probability;
  if (!picked) return <Empty>No games this week.</Empty>;
  const date = picked;
  const lead = (x: number) => (x === 0 ? "Tied" : x > 0 ? `Up ${fmt0(x)}` : `Down ${fmt0(-x)}`);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="score-band on-dark" aria-label="Score">
        <div className="teams">
          <Team init={initialsOf(me.name)} name={me.name} sub={`${me.wins}–${me.losses}${me.standing ? ` · ${ordinal(me.standing)}` : ""}`} color="var(--accent)" />
          <span className="pill-week">Week {m.matchup_period} · {Math.max(0, weekDays.length - played)} days left</span>
          <Team init={initialsOf(opp.name)} name={opp.name} sub={`${opp.wins}–${opp.losses}${opp.standing ? ` · ${ordinal(opp.standing)}` : ""}`} color="var(--opp)" right />
        </div>
        <div className="score-row">
          <span className="num">{fmt0(m.my_score)}</span>
          <div className="mid">
            <b>Score now</b>
            <small>{lead(now)}</small>
          </div>
          <span className="num r">{fmt0(m.opponent_score)}</span>
        </div>
        {path.length > 1 && (
          <div className="plans" role="radiogroup" aria-label="Your lineup for the rest of the week">
            {path.map((x) => (
              <button key={x.plan} role="radio" aria-checked={x.plan === (sc?.plan ?? "moves")} onClick={() => setPlan(x.plan)}>
                {x.label}
              </button>
            ))}
          </div>
        )}
        <div className="score-row">
          <span><span className="num proj-n" style={{ fontSize: 56 }}>{fmt0(mineFinal)}</span><span className="unit">proj.</span></span>
          <div className="mid" aria-live="polite">
            <b>Projected final</b>
            <small className={final != null && final > 0 ? "winning" : undefined}>
              <span>{final != null ? lead(final) : ""}</span>
              {pWin != null && <span>{Math.round(pWin * 100)}% to win</span>}
            </small>
          </div>
          <span className="r"><span className="unit">proj.</span><span className="num proj-n" style={{ fontSize: 56 }}>{fmt0(proj?.opponent)}</span></span>
        </div>
        {[["You", m.my_score, mineFinal, "var(--accent)"], [opp.name, m.opponent_score, proj?.opponent, "var(--opp)"]].map(([n, s, p, c]) => {
          // One scale for every plan, so switching plans moves the bar rather than the axis.
          const scale = Math.max(...path.map((x) => x.mine), proj?.mine ?? 0, proj?.opponent ?? 0, 1) * 1.08;
          const sNow = (s as number) ?? 0, sProj = (p as number) ?? sNow;
          return (
            <div className="track-row" key={n as string}>
              <span>{n as string}</span>
              <div className="track" role="img" aria-label={`${fmt0(sNow)} scored, ${fmt0(sProj)} projected`}>
                <span style={{ width: `${(sNow / scale) * 100}%`, background: c as string }} />
                <span className="hatch" style={{ width: `${(Math.max(0, sProj - sNow) / scale) * 100}%`, ["--c" as string]: c as string }} />
              </div>
            </div>
          );
        })}
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
            <Side title="You" color="var(--accent)" date={date} mine plan={sc?.plan ?? "moves"} />
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

function Side({ title, color, date, mine = false, plan = "moves" }: { title: string; color: string; date: string; mine?: boolean; plan?: Plan }) {
  const { data, players } = useData();
  if (!data) return null;
  const v = mine ? dayView(data, players, date) : null;
  const rec = sideDay(data, players, date, mine);
  // "As set" shows the lineup exactly as it is on ESPN; the other plans show the recommended one.
  const s = mine && plan === "as-set" && v
    ? (() => {
        const rows = v.starters
          .filter((r) => r.state === "play" || r.state === "live")
          .map((r) => ({ player: r.player, value: r.value, scored: r.scored }))
          .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
        return { ...rec, rows, total: rows.reduce((t, r) => t + (r.value ?? 0) + (r.scored ?? 0), 0) };
      })()
    : rec;
  const theirs = mine ? sideDay(data, players, date, false) : null;
  const when = date === data.meta.today ? "today" : weekday(date);
  const moves = v?.moves.length ?? 0;
  const top = data.recommendations.pickups[0];
  const add = top ? players.get(top.add_player_id) : undefined;
  return (
    <section className="card rows" style={{ padding: "18px 24px 8px" }} aria-label={`${title}, ${when}`}>
      <div className="roster-head">
        <span className="dot" style={{ background: color }} />
        <b>{title}</b>
        <span className="grow" />
        <span className="section-label">Proj. pts</span>
      </div>
      {mine && v && plan !== "as-set" && moves > 0 && (
        <p className="side-note">
          With your {moves === 1 ? "recommended move" : `${moves} recommended moves`} ({fmt(v.asSet)} as set on ESPN).
        </p>
      )}
      {mine && v && plan === "as-set" && <p className="side-note">Exactly as set on ESPN, no changes.</p>}
      {mine && plan === "add" && add && top && (
        <p className="side-note">Plus {lastName(add.name)}: {signed(top.gain_this_week)} proj. pts this week once he&rsquo;s added (not shown by day).</p>
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
