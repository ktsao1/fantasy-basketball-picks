"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { DayStepper, Empty, Photo, Tag, useDay, usePageTitle } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, monthDay, signed, weekday } from "@/lib/format";
import type { Data, Player } from "@/lib/types";
import { dayView, gameLine, gameOn, matchupProjection, pastDay, playerLocked, playerPoints, scoreThroughDate, sideDay, slotType, weekDays as allDays, type SideDay } from "@/lib/view";
import { emptyRosterPreview, previewDay, rosterSlots, rosterThrough, stageTransaction, transactionDate, type RosterPreview } from "@/lib/roster-preview";

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
  const { data, players, actuals, lineups, asOf, example } = useData();
  const all = data ? allDays(data) : [];
  const days = example && data ? all.filter((day) => day >= data.meta.today) : all;
  const [seed] = useState(() => swap !== null && data ? seedSwap(data, players, swap, asOf) : null);
  const seedDate = seed?.date;
  const [picked, setPicked] = useDay(days, data?.meta.today, seedDate);
  const [recommended, setRecommended] = useState(false);
  const [preview, setPreview] = useState(() => seed?.preview ?? emptyRosterPreview);
  const [previewError, setPreviewError] = useState(seed?.error);
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
  const m = data.matchup;
  const opp = data.opponent;
  if (m.is_bye || !opp) return <Empty>Bye week: no opponent this week.</Empty>;

  const me = data.my_team;
  const today = data.meta.today;
  if (!picked) return <Empty>No games this week.</Empty>;
  const date = picked;
  const past = date < today;
  const future = date > today;
  const remaining = all.filter((day) => day >= today);
  const previewDays = new Map(remaining.map((day) =>
    [day, previewDay(data, players, preview, day, recommended, asOf)] as const));
  const seededMove = seed?.preview?.transactions[0];
  const seededPlayer = seededMove?.add === undefined ? undefined : players.get(seededMove.add);
  const seededDrop = seededMove?.drop === undefined ? undefined : players.get(seededMove.drop);
  const seededSide = seededMove && previewDays.get(seededMove.date);
  const seededSlot = seededSide?.rows.find((row) => row.player.id === seededPlayer?.id)?.slot;
  const canAssignSeed = seededPlayer && seededMove && seededSide
    && (seededSlot || seededSide.off.some((player) => player.id === seededPlayer.id));
  const mySide = previewDays.get(date);
  const changed = recommended || preview.transactions.length > 0 || Object.values(preview.moves).some((moves) => moves.length > 0);
  const projection = past ? null : matchupProjection(data, players, previewDays, asOf);
  const baseline = !past && changed ? matchupProjection(data, players, new Map(remaining.map((day) =>
    [day, previewDay(data, players, emptyRosterPreview, day, false, asOf)] as const)), asOf) : null;
  const baselineMargin = baseline ? baseline.mine - baseline.opponent : null;
  const previewMargin = projection ? projection.mine - projection.opponent : null;
  const stage = (add?: Player, drop?: number) => {
    const effective = transactionDate(data, date, add);
    const result = stageTransaction(data, players, preview, { date: effective, add: add?.id, drop });
    setPreviewError(result.error);
    if (!result.transactions) return false;
    setPreview({ ...preview, transactions: result.transactions });
    return true;
  };
  const setSlot = (player: number, slot: string | null, onDay = date) => {
    setPreviewError(undefined);
    setPreview((current) => ({
      ...current,
      moves: { ...current.moves, [onDay]: [...(current.moves[onDay] ?? []), { player, slot }] },
    }));
  };
  const mineFinal = projection?.mine;
  const oppFinal = projection?.opponent;
  const pWin = projection?.win;
  const score = scoreThroughDate(data, players, actuals, lineups, date, asOf, previewDays);
  const hasStarted = !past && !future && data.players.some((player) => playerLocked(data, player, date, asOf));
  const status = past ? (actuals[date] ? "Final" : "Awaiting results") : hasStarted ? "Live / projected" : "Projected";
  const margin = score.mine == null || score.opponent == null ? null : Math.round(score.mine) - Math.round(score.opponent);
  const lead = (x: number) => (x === 0 ? "Tied" : x > 0 ? `Up ${fmt0(x)}` : `Down ${fmt0(-x)}`);
  const projectedMargin = mineFinal == null || oppFinal == null ? null : Math.round(mineFinal) - Math.round(oppFinal);
  const verdict =
    projectedMargin == null ? null
      : projectedMargin === 0 ? "Projected tie"
        : `${projectedMargin > 0 ? "You’re" : `${opp.name} is`} projected to win by ${fmt0(Math.abs(projectedMargin))}`;
  const youPct = pWin != null ? Math.round(pWin * 100) : null;
  return (
    <div className="stack matchup-page" style={{ gap: 24 }}>
      <h1 className="sr-only">Matchup</h1>
      {example && <Link className="example-back" href="/example">← Video example</Link>}
      <div className="matchup-score-dock">
        {showCompactScore && (
          <section className="matchup-compact-score" aria-label="Matchup score" aria-live="polite">
            <div><span>Your Team</span><strong className="num">{fmt0(mineFinal ?? score.mine)}</strong></div>
            <div className="matchup-compact-caption">
              <b>{projection ? "Projected final" : `Score through ${weekday(date)}`}</b>
              {projection && <small>{future ? `Through ${weekday(date)}` : "ESPN score"} · {fmt0(score.mine)}–{fmt0(score.opponent)}</small>}
            </div>
            <div><span>{opp.name}</span><strong className="num">{fmt0(oppFinal ?? score.opponent)}</strong></div>
          </section>
        )}
      </div>
      <section ref={scoreboard} className="score-band on-dark" aria-label="Score">
        <div className="teams">
          <Team init="YT" name="Your Team" sub={`${me.wins}–${me.losses}${me.standing ? ` · ${ordinal(me.standing)}` : ""}`} color="var(--accent-on-dark)" />
          <span className="pill-week">Week {m.matchup_period} · {all.length - score.through + Number(date === today)} days left</span>
          <Team init={initialsOf(opp.name)} name={opp.name} sub={`${opp.wins}–${opp.losses}${opp.standing ? ` · ${ordinal(opp.standing)}` : ""}`} color="var(--opp-on-dark)" right />
        </div>

        <div className={`score-row${future ? " score-projected" : ""}`} aria-live={showCompactScore ? "off" : "polite"}>
          <span className="num">{fmt0(score.mine)}</span>
          <div className="mid">
            {!future && <span className="src src-espn src-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- a 16px local mark */}
              <img src="/img/espn.png" alt="" width={16} height={16} />
              ESPN
            </span>}
            <b>{future ? "Projected through" : past ? "Score through" : "Score now"}{date !== today && ` ${weekday(date)}`}</b>
            <small>{margin == null ? "Score unavailable" : lead(margin)} · Day {score.through} of {all.length}</small>
          </div>
          <span className="num r">{fmt0(score.opponent)}</span>
        </div>

        {!past && <div className="proj-row" aria-live={showCompactScore ? "off" : "polite"}>
          <span className="proj-total"><span className="num">{fmt0(mineFinal)}</span> proj. total</span>
          <div className="proj-verdict">
            {verdict && <h2 className="verdict-line">{verdict}</h2>}
            {youPct != null && <p>Win chance · You {youPct}% · {opp.name} {100 - youPct}%</p>}
          </div>
          <span className="proj-total r">proj. total <span className="num">{fmt0(oppFinal)}</span></span>
        </div>}
      </section>

      <div className="matchup-toolbar">
        <DayStepper days={days} value={date} onChange={(day) => { setPreviewError(undefined); setPicked(day); }} today={today}
          label={(d) => ({ day: weekday(d), date: d === today ? dayShort(d) : monthDay(d) })}
          status={status} />
        {!past && changed && (
          <button type="button" className="chip" onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete("swap");
            if (seedDate) url.searchParams.set("day", date);
            window.history.replaceState(null, "", url);
            setPreview(emptyRosterPreview);
            setRecommended(false);
            setPreviewError(undefined);
          }}>Reset preview</button>
        )}
      </div>

      {!past && changed && (
        <section className="card matchup-preview-summary" aria-label="Roster preview">
          <div className="matchup-preview-copy">
            <h2>{seededPlayer && seededDrop ? `Add ${seededPlayer.name}, drop ${seededDrop.name}` : "Roster preview"}</h2>
            {seededMove && <p>Counts from {dayShort(seededMove.date)} · Preview only</p>}
            {canAssignSeed && (
              <label className="matchup-preview-assignment">
                <span>{seededPlayer.name} · {weekday(seededMove.date)} lineup</span>
                <select className="matchup-preview-input" value={seededSlot ?? ""} aria-label={`Lineup spot for ${seededPlayer.name}`}
                  disabled={playerLocked(data, seededPlayer, seededMove.date, asOf)}
                  onChange={(event) => setSlot(seededPlayer.id, event.target.value || null, seededMove.date)}>
                  <option value="">{seededSlot ? "Bench" : "On bench · choose a starting slot"}</option>
                  {seededSlot && <option value={seededSlot}>{seededSlot} · Starting</option>}
                  {starterOptions(data, seededPlayer, seededSide, seededSlot).map(({ slot, label }) =>
                    <option key={slot} value={slot}>Start at {label}</option>)}
                </select>
              </label>
            )}
          </div>
          {baselineMargin !== null && previewMargin !== null && (
            <div className="matchup-margin" aria-live="polite">
              <span>Projected weekly margin</span>
              <div><span>As set <b>{signed(baselineMargin)}</b></span><span aria-hidden>→</span><span>Preview <b>{signed(previewMargin)}</b></span></div>
              <strong>{signed(previewMargin - baselineMargin)} pts vs. as set</strong>
            </div>
          )}
        </section>
      )}
      {previewError && <p className="matchup-preview-error" role="alert">{previewError}</p>}
      <div className="rosters">
        {past ? (
          <>
            <PastSide title="You" color="var(--accent)" date={date} mine />
            <PastSide title={opp.name} color="var(--opp)" date={date} />
          </>
        ) : (
          <>
            <Side title="You" color="var(--accent)" date={date} mine previewSide={mySide} recommended={recommended}
              onRecommended={setRecommended} onSlot={setSlot} onDrop={(id) => stage(undefined, id)}
              previewed={changed}>
              <RosterPickups data={data} players={players} date={date} transactions={preview.transactions}
                excluded={new Set(preview.transactions.flatMap((move) => move.add === undefined ? [] : [move.add]))}
                onAdd={stage} />
              {preview.transactions.length > 0 && (
                <ul className="matchup-transaction-log" aria-label="Preview roster moves">
                  {preview.transactions.map((move, index) => (
                    <li key={index}>
                      {move.add !== undefined && `Add ${players.get(move.add)?.name}`}
                      {move.add !== undefined && move.drop !== undefined && " · "}
                      {move.drop !== undefined && `Drop ${players.get(move.drop)?.name}`}
                      { ` · ${monthDay(move.date)}`}
                    </li>
                  ))}
                </ul>
              )}
            </Side>
            <Side title={opp.name} color="var(--opp)" date={date} />
          </>
        )}
      </div>
    </div>
  );
}

type SwapSeed = { date: string; preview: RosterPreview; error?: never } | { error: string; date?: never; preview?: never };

function seedSwap(data: Data, players: Map<number, Player>, swap: string, asOf: number): SwapSeed {
  const error = "This swap is no longer available in the current matchup.";
  if (!/^\d+-\d+$/.test(swap)) return { error };
  const [addId, dropId] = swap.split("-").map(Number);
  const add = players.get(addId);
  const pickup = data.recommendations.pickups.find((pick) => pick.add_player_id === addId && pick.drop_player_id === dropId);
  if (!pickup || !add) return { error };
  const date = transactionDate(data, data.meta.today, add);
  if (!allDays(data).includes(date)) return { error };
  const result = stageTransaction(data, players, emptyRosterPreview, { date, add: add.id, drop: dropId });
  if (!result.transactions) return { error: result.error ?? error };
  const preview = { ...emptyRosterPreview, transactions: result.transactions };
  const side = previewDay(data, players, preview, date, false, asOf);
  const points = playerPoints(data, add, date, asOf);
  if (points.value !== null && !points.started) {
    const [best] = starterOptions(data, add, side).sort((a, b) => a.cost - b.cost);
    if (best && points.value > best.cost) preview.moves = { [date]: [{ player: add.id, slot: best.slot }] };
  }
  return { date, preview };
}

function starterOptions(data: Data, player: Player, side: SideDay, currentSlot?: string) {
  return rosterSlots(data).flatMap((slot) => {
    const occupant = side.rows.find((row) => row.slot === slot);
    if (slot === currentSlot || !player.positions.includes(slotType(slot)) || occupant?.started) return [];
    return [{ slot, label: occupant ? `${slot} · bench ${occupant.player.name}` : slot, cost: occupant?.value ?? 0 }];
  });
}

function RosterPickups({ data, players, date, transactions, excluded, onAdd }: {
  data: Data;
  players: Map<number, Player>;
  date: string;
  transactions: Parameters<typeof rosterThrough>[1];
  excluded: Set<number>;
  onAdd: (player: Player, drop?: number) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidateId, setCandidateId] = useState<number>();
  const [dropId, setDropId] = useState<number>();
  const candidate = candidateId === undefined ? undefined : players.get(candidateId);
  const picks = new Map(data.recommendations.pickups.map((pickup, index) => [pickup.add_player_id, { pickup, index }]));
  const agents = [...players.values()].filter((player) =>
    player.owner === null && !excluded.has(player.id) && player.name.toLowerCase().includes(query.trim().toLowerCase()),
  ).sort((a, b) => (picks.get(a.id)?.index ?? Infinity) - (picks.get(b.id)?.index ?? Infinity)
    || (a.free_agent_rank ?? Infinity) - (b.free_agent_rank ?? Infinity) || a.name.localeCompare(b.name));
  const effective = candidate ? transactionDate(data, date, candidate) : date;
  const roster = rosterThrough(data, transactions, effective);

  return (
    <div className="matchup-roster-pickups">
      <button type="button" className="chip matchup-edit" aria-expanded={open} aria-controls="matchup-pickups"
        onClick={() => setOpen(!open)}>
        {open ? "Hide free agents" : "+ Add free agent"}
      </button>
      <div id="matchup-pickups" hidden={!open}>
        <input type="search" className="matchup-preview-input" aria-label="Search available free agents" placeholder="Search free agents"
          value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="matchup-pickups" role="group" aria-label="Available free agents">
          {agents.map((agent) => {
            const pick = picks.get(agent.id);
            const suggested = pick?.pickup.drop_player_id;
            const gain = pick?.pickup.gain_this_week;
            return (
              <button type="button" className="matchup-pickup" key={agent.id} aria-pressed={agent.id === candidateId}
                onClick={() => {
                  setCandidateId(agent.id);
                  const available = rosterThrough(data, transactions, transactionDate(data, date, agent));
                  setDropId(suggested != null && available.some((r) => r.player_id === suggested) ? suggested : undefined);
                }}>
                <Photo p={agent} size={38} round />
                <span className="matchup-pickup-player">
                  <strong>{agent.name}</strong>
                  {pick?.index === 0 && <Tag tone="rec-soft">Recommended</Tag>}
                  <small>{agent.free_agent_status === "WAIVERS" ? "Waivers" : agent.nba_team}
                    {suggested != null && ` · Suggested drop: ${players.get(suggested)?.name}`}
                  </small>
                </span>
                <span className="matchup-pickup-points" data-gain={gain === undefined ? undefined : Math.sign(gain)}>
                  {gain !== undefined && <><span className="num">{signed(gain)}</span><small>est. gain</small></>}
                </span>
                <span className="matchup-pickup-symbol" aria-hidden>+</span>
              </button>
            );
          })}
          {agents.length === 0 && <Empty>No matching free agents.</Empty>}
        </div>
        {candidate && !excluded.has(candidate.id) && (
          <form className="matchup-add-form" onSubmit={(event) => {
            event.preventDefault();
            if (onAdd(candidate, dropId)) { setCandidateId(undefined); setDropId(undefined); }
          }}>
            <p><strong>Add {candidate.name}</strong> · Counts from {monthDay(effective)}
              {effective > (allDays(data).at(-1) ?? effective) && " (after this matchup)"}
            </p>
            <label>Player to drop
              <select className="matchup-preview-input" value={dropId ?? ""} onChange={(event) => setDropId(event.target.value ? Number(event.target.value) : undefined)}>
                <option value="">No drop</option>
                {roster.map((entry) => <option key={entry.player_id} value={entry.player_id}>{players.get(entry.player_id)?.name}</option>)}
              </select>
            </label>
            <button type="submit" className="chip matchup-edit">Preview add</button>
          </form>
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

function Side({ title, color, date, mine = false, previewSide, recommended = true, onRecommended, onSlot, onDrop, previewed, children }: {
  title: string;
  color: string;
  date: string;
  mine?: boolean;
  previewSide?: SideDay;
  recommended?: boolean;
  onRecommended?: (enabled: boolean) => void;
  onSlot?: (id: number, slot: string | null) => void;
  onDrop?: (id: number) => void;
  previewed?: boolean;
  children?: ReactNode;
}) {
  const { data, players, asOf } = useData();
  if (!data) return null;
  const s = previewSide ?? sideDay(data, players, date, mine, asOf);
  const theirs = mine ? sideDay(data, players, date, false, asOf) : null;
  const when = date === data.meta.today ? "today" : weekday(date);
  const hasStarted = s.rows.some((row) => row.started);
  const moves = mine ? dayView(data, players, date, asOf).moves : [];
  const recommendedMoves = new Map(moves.map((move) => [move.start.id, move]));
  const bench = s.off.map((player) => playerPoints(data, player, date, asOf))
    .sort((a, b) => (b.value ?? b.scored ?? -1) - (a.value ?? a.scored ?? -1));
  const actions = (player: Player, currentSlot?: string) => {
    if (!onSlot || !onDrop) return undefined;
    const locked = playerLocked(data, player, date, asOf);
    const eligible = data.my_team.roster.find((entry) => entry.player_id === player.id)?.lineup_slot !== "IR";
    const options = locked || !eligible ? [] : starterOptions(data, player, s, currentSlot);
    return (
      <details className="matchup-player-actions" name="matchup-player-actions">
        <summary className="chip" aria-label={`Actions for ${player.name}`}>Actions</summary>
        <div className="matchup-player-menu">
          {options.length > 0 && (
            <div className="matchup-start-options" role="group" aria-label={`Start ${player.name}`}>
              {options.map((option) => (
                <button key={option.slot} type="button" onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  onSlot(player.id, option.slot);
                }}>Start at {option.label}</button>
              ))}
            </div>
          )}
          {currentSlot && !locked && <button type="button" className="chip" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); onSlot(player.id, null); }}>Bench</button>}
          <button type="button" className="chip" onClick={() => onDrop(player.id)}>Preview drop</button>
          {locked && <small>Lineup locked for this game</small>}
        </div>
      </details>
    );
  };
  return (
    <section className="card rows" style={{ padding: "18px 24px 8px" }} aria-label={`${title}, ${when}`}>
      <div className="roster-head">
        <span className="dot" style={{ background: color }} />
        <b>{title}</b>
        {previewed && <Tag tone="rec-soft">Preview</Tag>}
      </div>
      {!s.available && <Empty>Their daily lineup isn&rsquo;t in this snapshot.</Empty>}
      {s.available && s.rows.length === 0 && <Empty>Nobody plays {when}.</Empty>}
      {s.rows.map(({ player, value, scored, started, slot }) => (
        <MatchupPlayer key={player.id} player={player} date={date} slot={mine ? slot : undefined}
          value={scored ?? value} locked={started} pointsLabel={started ? (scored === null ? "Score pending" : "Scored") : hasStarted ? "Proj." : undefined}
          actions={actions(player, slot)} />
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
      {s.available && bench.length > 0 && (
        <div className="matchup-bench">
          <div className="matchup-bench-head">
            <h3>Bench</h3>
            {onRecommended && (
              <label className="matchup-starter-control">
                <input type="checkbox" checked={recommended} onChange={(event) => onRecommended(event.target.checked)} />
                Use recommended starters
              </label>
            )}
          </div>
          <div className="rows">
            {bench.map(({ player, value, scored, started }) => {
              const move = recommendedMoves.get(player.id);
              return (
                <MatchupPlayer key={player.id} player={player} date={date} value={scored ?? value} locked={started} dim={!gameOn(player, date)}
                  pointsLabel={started ? (scored === null ? "Score pending" : "Scored") : "Proj."} marker={move ? `Start at ${move.slot}` : undefined}
                  note={move?.out ? `For ${move.out.name}` : undefined} actions={actions(player)} />
              );
            })}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

function MatchupPlayer({ player, date, slot, value, pointsLabel, marker, note, actions, locked, dim = false }: {
  player: Player;
  date: string;
  slot?: string;
  value: number | null;
  pointsLabel?: string;
  marker?: string;
  note?: string;
  actions?: ReactNode;
  locked?: boolean;
  dim?: boolean;
}) {
  return (
    <div className={`row matchup-player${dim ? " dim" : ""}`}>
      {slot && <span className="slot" aria-label={`Slot ${slot}`}>{slot}</span>}
      <Photo p={player} size={40} round dim={dim} />
      <div className="who">
        <div className="who-top">
          <strong>{player.name}</strong>
          {marker && <Tag tone="rec-soft">{marker}</Tag>}
          {player.injury_status === "DAY_TO_DAY" && <Tag tone="warn">Day-to-day</Tag>}
        </div>
        <small>{gameLine(player, date, locked) ?? `${player.nba_team} · No game`}{note && ` · ${note}`}</small>
      </div>
      <div className={`proj ${pointsLabel === "Scored" ? "match-actual" : "match-projected"}`}>
        <span className="num">{fmt(value)}</span>
        {pointsLabel && (value != null || locked) && <small>{pointsLabel === "Score pending" && value != null ? "Last estimate" : pointsLabel}</small>}
      </div>
      {actions}
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
