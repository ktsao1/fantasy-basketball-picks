"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { DateCalendar } from "@/components/DateCalendar";
import { Chevron, Empty, Photo, Tag, useDay, usePageTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { fmt, monthDay, signed, weekday } from "@/lib/format";
import type { Data, Player } from "@/lib/types";
import { addStart, dayView, gameLine, matchupProjection, myLineupDay, pastDay, playerLocked, scoreThroughDate, opponentLineupDay, weekDays as allDays, type SideDay } from "@/lib/view";

const matchupTabs = [
  { id: "lineups", label: "Head-to-head" },
  { id: "impact", label: "Move impact" },
] as const;
type PreviewMoves = { dates: string[]; pickupId: string | null };
const noMoves: PreviewMoves = { dates: [], pickupId: null };

type MatchupTab = (typeof matchupTabs)[number]["id"];

const fmt0 = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));

export function Matchup() {
  return <Suspense fallback={<p className="loading" role="status">Loading matchup…</p>}><MatchupRoute /></Suspense>;
}

function MatchupRoute() {
  const swap = useSearchParams().get("swap");
  return <MatchupPage key={swap} swap={swap} />;
}

function MatchupPage({ swap }: { swap: string | null }) {
  usePageTitle("Matchup");
  const { data, players, actuals, lineups, asOf } = useData();
  const days = data ? allDays(data) : [];
  const [picked, setPicked] = useDay(days, data?.meta.today);
  const [tab, setTab] = useState<MatchupTab | null>(null);
  const [previewMoves, setPreviewMoves] = useState(noMoves);
  const [showCompactScore, setShowCompactScore] = useState(false);
  const scoreboard = useRef<HTMLElement>(null);
  const matchupReady = !!data?.opponent && !data.matchup.is_bye && !!picked;
  useEffect(() => {
    const banner = scoreboard.current;
    if (!matchupReady || !banner) return;

    const observer = new IntersectionObserver(([entry]) => {
      setShowCompactScore(entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(banner);
    return () => observer.disconnect();
  }, [matchupReady]);
  if (!data) return null;
  const opp = data.opponent;
  if (data.matchup.is_bye || !opp) return <Empty>Bye week: no opponent this week.</Empty>;

  const me = data.my_team;
  const today = data.meta.today;
  if (!picked) return <Empty>No games this week.</Empty>;
  const date = picked;
  const past = date < today;
  const activeTab = tab ?? (swap && !past ? "impact" : "lineups");
  function switchTab(event: KeyboardEvent<HTMLButtonElement>, current: MatchupTab) {
    let next: MatchupTab;
    switch (event.key) {
      case "Home": next = "lineups"; break;
      case "End": next = "impact"; break;
      case "ArrowLeft":
      case "ArrowRight": next = current === "lineups" ? "impact" : "lineups"; break;
      default: return;
    }
    event.preventDefault();
    setTab(next);
    document.getElementById(`matchup-tab-${next}`)?.focus();
  }
  const future = date > today;
  const onFinalDay = future && date === days.at(-1);
  const projection = past ? null : matchupProjection(data, players, asOf);
  const mineFinal = projection?.mine;
  const oppFinal = projection?.opponent;
  const pWin = projection?.win;
  const score = scoreThroughDate(data, players, actuals, lineups, date, asOf);
  const margin = score.mine == null || score.opponent == null ? null : Math.round(score.mine) - Math.round(score.opponent);
  const lead = (x: number) => (x === 0 ? "Tied" : x > 0 ? `Up ${fmt0(x)}` : `Down ${fmt0(-x)}`);
  const projectedMargin = mineFinal == null || oppFinal == null ? null : Math.round(mineFinal) - Math.round(oppFinal);
  const verdict =
    projectedMargin == null ? null
      : projectedMargin === 0 ? "Projected tie"
        : `${projectedMargin > 0 ? "You’re" : `${opp.name} is`} projected to win by ${fmt0(Math.abs(projectedMargin))}`;
  const youPct = pWin != null ? Math.round(pWin * 100) : null;
  return (
    <div className="stack matchup-page">
      <h1 className="sr-only">Matchup</h1>
      <div className="matchup-score-dock">
        {showCompactScore && (
          <section className="matchup-compact-score" aria-label="Matchup score" aria-live="polite">
            <div><span>Your Team</span><strong className="num">{fmt0(mineFinal ?? score.mine)}</strong></div>
            <div className="matchup-compact-caption">
              <b>{projection ? "Projected final · As set" : `Score through ${weekday(date)}`}</b>
              {projection && <small>{future ? `Through ${weekday(date)}` : "ESPN score"} · {fmt0(score.mine)}–{fmt0(score.opponent)}</small>}
            </div>
            <div><span>{opp.name}</span><strong className="num">{fmt0(oppFinal ?? score.opponent)}</strong></div>
          </section>
        )}
      </div>
      <section ref={scoreboard} className="score-band on-dark" aria-label="Score">
        <div className="teams">
          <Team init="YT" name="Your Team" sub={`${me.wins}–${me.losses}${me.standing ? ` · ${ordinal(me.standing)}` : ""}`} color="var(--accent-on-dark)" />
          <div className="matchup-date">
            <DateCalendar dates={days} date={date} label="Matchup date" variant="scoreboard" onChange={(day) => {
              setPicked(day);
              if (day < today) setTab("lineups");
            }} />
          </div>
          <Team init={initialsOf(opp.name)} name={opp.name} sub={`${opp.wins}–${opp.losses}${opp.standing ? ` · ${ordinal(opp.standing)}` : ""}`} color="var(--opp-on-dark)" right />
        </div>

        <div className={`score-row${future ? " score-projected" : ""}`} aria-live={showCompactScore ? "off" : "polite"}>
          <span key={`mine-${date}`} className="num score-value">{fmt0(score.mine)}</span>
          <div className="mid">
            {!future && <span className="src src-espn src-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- a 16px local mark */}
              <img src="/img/espn.png" alt="" width={16} height={16} />
              ESPN
            </span>}
            <b>{onFinalDay ? "Projected final" : future ? "Projected through" : past ? "Score through" : "Score now"}
              {date !== today && !onFinalDay && ` ${weekday(date)}`}</b>
            <small>{margin == null ? "Score unavailable" : lead(margin)} · <span className="score-day-count">Day {score.through} of {days.length}</span></small>
          </div>
          <span key={`opponent-${date}`} className="num r score-value">{fmt0(score.opponent)}</span>
        </div>

        {!past && <div className={`proj-row${onFinalDay ? " proj-row-final" : ""}`} aria-live={showCompactScore ? "off" : "polite"}>
          {!onFinalDay && <span className="proj-total"><span className="num">{fmt0(mineFinal)}</span> proj. total</span>}
          <div className="proj-verdict">
            {verdict && <h2 className="verdict-line">{verdict}</h2>}
            <p>Your lineup as set{youPct != null && ` · Win chance ${youPct}%`}</p>
          </div>
          {!onFinalDay && <span className="proj-total r">proj. total <span className="num">{fmt0(oppFinal)}</span></span>}
        </div>}
      </section>

      <div className="matchup-workspace">
        <div className="matchup-toolbar">
          <div className="matchup-tabs" role="tablist" aria-label="Matchup view">
            {matchupTabs.map(({ id, label }) => (
              <button key={id} id={`matchup-tab-${id}`} type="button" role="tab"
                aria-controls={`matchup-panel-${id}`} aria-selected={activeTab === id} tabIndex={activeTab === id ? 0 : -1}
                onClick={() => setTab(id)} onKeyDown={(event) => switchTab(event, id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div id="matchup-panel-lineups" role="tabpanel" aria-labelledby="matchup-tab-lineups" tabIndex={0} hidden={activeTab !== "lineups"}>
          <div className="rosters">
            {past ? (
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
        <div id="matchup-panel-impact" role="tabpanel" aria-labelledby="matchup-tab-impact" tabIndex={0} hidden={activeTab !== "impact"}>
          {past ? (
            <div className="card"><Empty>Choose today or a later day to see recommendations.</Empty></div>
          ) : (
            <RecommendationImpact data={data} players={players} date={date} asOf={asOf} swap={swap}
              projection={projection} opponentName={opp.name} preview={previewMoves}
              onPreview={setPreviewMoves} />
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationImpact({ data, players, date, asOf, swap, projection, opponentName, preview, onPreview }: {
  data: Data;
  players: Map<number, Player>;
  date: string;
  asOf: number;
  swap: string | null;
  projection: { mine: number; opponent: number } | null;
  opponentName: string;
  preview: PreviewMoves;
  onPreview: (moves: PreviewMoves) => void;
}) {
  const { moves } = dayView(data, players, date, asOf);
  const remaining = allDays(data).filter((day) => day >= data.meta.today);
  const pickups = data.recommendations.pickups.flatMap((pickup) => {
    const add = players.get(pickup.add_player_id);
    const drop = pickup.drop_player_id == null ? undefined : players.get(pickup.drop_player_id);
    if (!add || !drop) return [];
    const first = addStart(data, add);
    const effective = remaining.find((day) => day >= first
      && !playerLocked(data, add, day, asOf) && !playerLocked(data, drop, day, asOf));
    if (!effective) return [];
    return [{ id: `${add.id}-${drop.id}`, add, drop, effective, pickup }];
  });
  const linked = pickups.find((pickup) => pickup.id === swap);
  const visible = linked
    ? [linked, ...pickups.filter((pickup) => pickup !== linked).slice(0, 4)]
    : pickups.slice(0, 5);
  const applied = visible.find((pickup) => pickup.id === preview.pickupId);
  const startsApplied = preview.dates.includes(date);
  const swapActive = !!applied && date >= applied.effective;
  const hasPreview = !!applied || preview.dates.length > 0;
  const baseline = myLineupDay(data, players, date, asOf);
  const projected = (day: string) => myLineupDay(data, players, day, asOf,
    preview.dates.includes(day), applied && day >= applied.effective ? applied.pickup : undefined);
  const lineup = swapActive || startsApplied ? projected(date) : baseline;
  const change = (side: SideDay) => side.rows.reduce((total, row) => total + (row.value ?? 0), 0);
  const weeklyGain = hasPreview ? remaining.reduce((total, day) =>
    total + change(projected(day)) - change(myLineupDay(data, players, day, asOf)), 0) : 0;
  const changedSlots = new Set(lineup.rows.filter((row) =>
    !baseline.rows.some((original) => original.slot === row.slot && original.player.id === row.player.id)
  ).map((row) => row.slot));
  const linkedId = linked?.id;
  useEffect(() => {
    if (linkedId && window.location.hash === "#pickup-impact") {
      document.getElementById("pickup-impact")?.scrollIntoView();
    }
  }, [linkedId]);

  return (
    <section className="matchup-impact" aria-label="Recommendation impact">
      <div className="card matchup-impact-group matchup-recommendations">
        <header className="matchup-impact-header">
          <h2>Recommended moves</h2>
          <p>Preview lineup changes and one pickup at a time.</p>
        </header>
        <section className="impact-move-section" aria-labelledby="start-impact-heading">
          <div className="impact-section-head">
            <div>
              <h3 id="start-impact-heading">Start / sit</h3>
              <small>{weekday(date)}, {monthDay(date)}</small>
            </div>
            {moves.length > 0 && !swapActive && (
              <button type="button" className="impact-action" data-active={startsApplied || undefined}
                onClick={() => onPreview({ ...preview, dates: startsApplied ? preview.dates.filter((day) => day !== date) : [...preview.dates, date] })}>
                {startsApplied ? "Undo start / sit" : "Preview start / sit"}
              </button>
            )}
          </div>
          {startsApplied && !swapActive && <a className="impact-lineup-link" href="#lineup-preview">View lineup preview</a>}
          {swapActive ? <p className="impact-note">The pickup preview already uses the best available starters.</p> : moves.length === 0 ? (
            <p className="impact-note">No start/sit changes recommended.</p>
          ) : (
            <ul className="matchup-impact-list">
              {moves.map((move) => (
                <li key={move.start.id}>
                  <div className="impact-pair">
                    <ImpactPlayer player={move.start} action={`Start at ${move.slot}`} />
                    {move.out ? (
                      <>
                        <Chevron dir="right" />
                        <ImpactPlayer player={move.out} action="Replaces" outgoing />
                      </>
                    ) : <small className="impact-open-slot">Fills an open slot</small>}
                  </div>
                  {move.lock && <small className="impact-lock">Locks {move.lock}</small>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="impact-move-section" id="pickup-impact" aria-labelledby="pickup-impact-heading">
          <div className="impact-section-head">
            <div>
              <h3 id="pickup-impact-heading">Free-agent add / drop</h3>
              {visible.length > 0 && <small>Pickup estimates assume recommended starters.</small>}
            </div>
          </div>
          {visible.length === 0 ? <p className="impact-note">No recommended pickups count toward this matchup.</p> : (
            <ul className="matchup-impact-list pickup-impact-list">
              {visible.map(({ id, add, drop, effective, pickup }) => {
                const isApplied = id === applied?.id;
                return (
                  <li key={id} className="matchup-impact-swap" data-linked={id === (applied?.id ?? linkedId) || undefined}>
                    <div className="impact-pair">
                      <ImpactPlayer player={add} action={add.free_agent_status === "WAIVERS" ? "Claim" : "Add"}
                        href={`/free-agents/${add.id}`} />
                      <Chevron dir="right" />
                      <ImpactPlayer player={drop} action="Drop" outgoing />
                    </div>
                    <div className="impact-swap-footer">
                      <div>
                        <ImpactGain gain={pickup.gain_this_week} />
                        <small>Counts from {monthDay(effective)}</small>
                      </div>
                      <div className="impact-swap-actions">
                        {isApplied && <a className="impact-lineup-link" href="#lineup-preview">View lineup preview</a>}
                        <button type="button" className="impact-action" data-active={isApplied || undefined}
                          aria-label={`${isApplied ? "Undo" : "Preview"} ${add.name} swap`}
                          onClick={() => onPreview({ ...preview, pickupId: isApplied ? null : id })}>
                          {isApplied ? "Undo swap" : "Preview swap"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <div className="matchup-preview" id="lineup-preview">
        <Side title="Your lineup" color="var(--accent)" date={date} mine lineup={lineup}
          previewing={swapActive || startsApplied} changedSlots={changedSlots} summary={
            <div className="impact-preview-summary">
              <div aria-live="polite">
                <small>Projected score this week</small>
                {projection ? (
                  <div className="impact-preview-result">
                    <div>
                      <span>Your team</span>
                      <strong key={weeklyGain} className="num score-value">{fmt0(projection.mine + weeklyGain)}</strong>
                      {hasPreview && <small>{signed(weeklyGain)} pts from preview</small>}
                    </div>
                    <small>vs.</small>
                    <div>
                      <span>{opponentName}</span>
                      <strong className="num">{fmt0(projection.opponent)}</strong>
                    </div>
                  </div>
                ) : <p className="impact-note">Weekly score projection unavailable.</p>}
              </div>
              <div className="impact-preview-footer">
                <p>{applied ? `Previewing ${applied.add.name} from ${monthDay(applied.effective)}.`
                  : hasPreview ? "Previewing selected start/sit changes." : "Select a move to see it in your lineup."}</p>
                {hasPreview && <button type="button" className="impact-action" onClick={() => onPreview(noMoves)}>Reset preview</button>}
              </div>
            </div>
          } />
      </div>
    </section>
  );
}

function ImpactPlayer({ player, action, href, outgoing = false }: {
  player: Player;
  action: string;
  href?: string;
  outgoing?: boolean;
}) {
  const identity = (
    <>
      <Photo key={player.id} p={player} size={44} />
      <span className="impact-player-copy">
        <small>{action}</small>
        <strong>{player.name}</strong>
      </span>
    </>
  );
  return href
    ? <Link className="impact-player" href={href}>{identity}</Link>
    : <div className={`impact-player${outgoing ? " impact-player-out" : ""}`}>{identity}</div>;
}

function ImpactGain({ gain }: { gain: number }) {
  return <span className="matchup-impact-gain" data-direction={Math.sign(gain)}>
    <strong className="num">{signed(gain)}</strong><small>proj. pts</small>
  </span>;
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

function Side({ title, color, date, mine = false, lineup, previewing, changedSlots, summary }: {
  title: string;
  color: string;
  date: string;
  mine?: boolean;
  lineup?: SideDay;
  previewing?: boolean;
  changedSlots?: Set<string>;
  summary?: ReactNode;
}) {
  const { data, players, asOf } = useData();
  if (!data) return null;
  const s = lineup ?? (mine ? myLineupDay(data, players, date, asOf) : opponentLineupDay(data, players, date, asOf));
  const theirs = mine ? opponentLineupDay(data, players, date, asOf) : null;
  const when = date === data.meta.today ? "today" : weekday(date);
  const hasStarted = s.rows.some((row) => row.started);
  return (
    <section className="card rows" style={{ padding: "18px 24px 8px" }} aria-label={`${title}, ${when}`}>
      <div className="roster-head">
        <span className="dot" style={{ background: color }} />
        <b>{title}</b>
        {mine && <span className="muted">{previewing ? "Preview only" : "As set on ESPN"}</span>}
      </div>
      {summary}
      {!s.available && <Empty>Their daily lineup isn&rsquo;t in this snapshot.</Empty>}
      {s.available && s.rows.length === 0 && <Empty>Nobody plays {when}.</Empty>}
      {s.rows.map(({ player, value, scored, started, slot }) => (
        <MatchupPlayer key={player.id} player={player} date={date} slot={mine ? slot : undefined} changed={changedSlots?.has(slot)}
          value={scored ?? value} locked={started} pointsLabel={started ? (scored === null ? "Score pending" : "Scored") : hasStarted ? "Proj." : undefined} />
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
      <SittingOut names={s.off.map((player) => player.name)} />
    </section>
  );
}

function MatchupPlayer({ player, date, slot, value, pointsLabel, locked, changed }: {
  player: Player;
  date: string;
  slot?: string;
  value: number | null;
  pointsLabel?: string;
  locked?: boolean;
  changed?: boolean;
}) {
  return (
    <div className={`row matchup-player${changed ? " matchup-player-changed" : ""}`}>
      {slot && <span className="slot" aria-label={`Slot ${slot}`}>{slot}</span>}
      <Photo p={player} size={40} round />
      <div className="who">
        <div className="who-top">
          <strong>{player.name}</strong>
          {player.injury_status === "DAY_TO_DAY" && <Tag tone="warn">Day-to-day</Tag>}
        </div>
        <small>{gameLine(player, date, locked) ?? `${player.nba_team} · No game`}</small>
      </div>
      <div className={`proj ${pointsLabel === "Scored" ? "match-actual" : "match-projected"}`}>
        <span className="num">{fmt(value)}</span>
        {pointsLabel && (value != null || locked) && <small>{pointsLabel === "Score pending" && value != null ? "Last estimate" : pointsLabel}</small>}
      </div>
    </div>
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
