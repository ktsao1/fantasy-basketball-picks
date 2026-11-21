"use client";

import Link from "next/link";
import { useData } from "@/lib/data";
import { fmt, lastName, signed, weekday } from "@/lib/format";
import { addTiming, dropCaution, nextMoves, pickupValue, pts, type DayView } from "@/lib/view";
import { Card, Chevron, Meter, Photo, Tag } from "./ui";

/** Start/sit for the chosen day: the moves to make on ESPN, or why none are needed. */
export function StartSit({ v, isToday, onJump }: { v: DayView; isToday: boolean; onJump?: (date: string) => void }) {
  const { data, players } = useData();
  const when = isToday ? "tonight" : weekday(v.date);
  const n = v.moves.length;
  // Nothing to do on this day: point at the next day that has moves, so they aren't missed.
  const next = n === 0 && data ? nextMoves(data, players, v.date) : null;
  return (
    <Card title="Start / sit">
      {n === 0 ? (
        <>
          <p>No changes needed {when}.</p>
          {next && onJump && (
            <button className="next-moves" onClick={() => onJump(next.date)}>
              <span>
                <b>{weekday(next.date)}: {next.moves.length} {next.moves.length === 1 ? "change" : "changes"}</b>
                <small>{signed(next.withMoves - next.asSet)} proj. pts over the lineup as set</small>
              </span>
              <Chevron dir="right" />
            </button>
          )}
        </>
      ) : (
        <p>Make {n === 1 ? "this change" : `these ${n} changes`} on ESPN before tip-off.</p>
      )}
      <div className="rows" style={{ marginTop: n || v.watch.length ? 12 : 0 }}>
        {v.moves.map((m) => {
          const outRow = v.starters.find((r) => r.player.id === m.out?.id);
          const outValue = outRow?.value ?? 0;
          const empty = !outRow || outRow.state === "idle" || outRow.state === "out";
          return (
            <div className="move" key={m.start.id}>
              <span className="pair">
                <Photo p={m.start} size={34} round />
                {m.out && <Photo p={m.out} size={34} round dim />}
              </span>
              <div className="who">
                <div className="who-top">
                  <span className="slot" style={{ width: "auto", color: "var(--muted)", fontSize: 11 }}>{m.slot}</span>
                  <b>Start {lastName(m.start.name)}</b>
                </div>
                <small>
                  {m.out ? `for ${lastName(m.out.name)}` : `into the open ${m.slot} slot`}
                  {m.lock && ` · locks ${m.lock}`}
                </small>
              </div>
              {m.value != null && (
                <div className="proj">
                  <span className="num" style={{ fontSize: 20, color: "var(--pos)" }}>{signed(m.value - outValue)}</span>
                  <small>{empty ? "fills an empty slot" : "proj. pts"}</small>
                </div>
              )}
            </div>
          );
        })}
        {n === 0 &&
          v.watch.map((p) => (
            <div className="move" key={p.id}>
              <Photo p={p} size={36} round />
              <div className="who">
                <div className="who-top">
                  <strong>Watch {lastName(p.name)}</strong>
                  <Tag tone="warn">Day-to-day</Tag>
                </div>
                <small>No bench player can cover if he sits.</small>
              </div>
            </div>
          ))}
      </div>
    </Card>
  );
}

/** The week's best free-agent swap, with the alternatives. */
export function FreeAgency({ isToday = true }: { isToday?: boolean }) {
  const { data, players } = useData();
  if (!data) return null;
  const [top, ...rest] = data.recommendations.pickups; // engine order = value order
  const add = top && players.get(top.add_player_id);
  const drop = top?.drop_player_id != null ? players.get(top.drop_player_id) : undefined;
  // The caution is about making the move right now, so it belongs on today's view only.
  const caution = isToday ? dropCaution(data, drop) : null;
  // The single biggest reason, in words; the detail page has the rest.
  const lead = top?.factors?.find((f) => f.impact_fpts != null) ?? top?.factors?.[0];
  const why = lead?.label ? pts(lead.label[0].toUpperCase() + lead.label.slice(1)) : null;

  return (
    <Card
      title="Free agency moves"
      aside={<span className="muted" style={{ fontSize: 12 }}>{addTiming(data)}</span>}
    >
      {!top || !add ? (
        <p className="muted">No free agent beats anyone on your roster this week.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <Link href={`/free-agents/${add.id}`} className="swap">
            <div className="swap-player">
              <Photo p={add} w={112} h={84} />
              <div>
                <small>Add</small>
                <b>{add.name}</b>
                <span>{add.nba_team} · {add.primary_position}</span>
              </div>
            </div>
            <span className="muted" aria-hidden style={{ paddingBottom: 44 }}>&rarr;</span>
            {drop && (
              <div className="swap-player out">
                <Photo p={drop} w={112} h={84} dim />
                <div>
                  <small>Drop</small>
                  <b>{drop.name}</b>
                  <span>{drop.nba_team} · {drop.primary_position}</span>
                </div>
              </div>
            )}
            <div className="gain">
              <span className="gain-pill"><span className="num">{signed(top.gain_this_week)}</span></span>
              <small>proj. pts this week</small>
            </div>
          </Link>
          {why && <p className="muted" style={{ fontSize: 13 }}>{why}</p>}
          {caution && <p className="caution">{caution}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Meter c={top.confidence} />
            <Link href={`/free-agents/${add.id}`} className="btn" style={{ marginLeft: "auto" }}>See why</Link>
          </div>
          {rest.length > 0 && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <p className="section-label options-head"><span>Other options</span><span>Value · this week</span></p>
              {rest.map((x) => {
                const p = players.get(x.add_player_id);
                const d = x.drop_player_id != null ? players.get(x.drop_player_id) : undefined;
                if (!p) return null;
                return (
                  <Link href={`/free-agents/${p.id}`} className="option" key={p.id}>
                    <Photo p={p} size={34} round />
                    <div className="who">
                      <b style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</b>
                      <small>{p.nba_team} · {p.primary_position}{d && d.id !== drop?.id ? ` · drop ${lastName(d.name)}` : ""}</small>
                    </div>
                    <span className="option-nums">
                      <span className="num">{fmt(pickupValue(data, x))}</span>
                      <small>{signed(x.gain_this_week)} this week</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
