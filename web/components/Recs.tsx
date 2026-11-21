"use client";

import Link from "next/link";
import { useData } from "@/lib/data";
import { lastName, signed, weekday } from "@/lib/format";
import type { DayView } from "@/lib/view";
import { Card, Meter, Photo, Tag } from "./ui";

/** Start/sit for the chosen day: the moves to make on ESPN, or why none are needed. */
export function StartSit({ v, isToday }: { v: DayView; isToday: boolean }) {
  const when = isToday ? "tonight" : weekday(v.date);
  const n = v.moves.length;
  return (
    <Card title="Start / sit" aside={<Tag tone="rec-soft">{n ? `${n} recommended move${n === 1 ? "" : "s"}` : "No moves needed"}</Tag>}>
      {n === 0 ? (
        <p>Your lineup as set on ESPN is already the best one for {when}.</p>
      ) : (
        <p>Make {n === 1 ? "this change" : "these changes"} on ESPN before each player&rsquo;s tip-off.</p>
      )}
      <div className="rows" style={{ marginTop: 12 }}>
        {v.moves.map((m) => {
          const outValue = v.starters.find((r) => r.player.id === m.out?.id)?.value ?? 0;
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
                  <small>proj. pts</small>
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
                <small>No bench player has a game {when} to swap in if he sits.</small>
              </div>
            </div>
          ))}
      </div>
    </Card>
  );
}

/** The week's best free-agent swap, with the alternatives. */
export function FreeAgency() {
  const { data, players } = useData();
  if (!data) return null;
  const [top, ...rest] = data.recommendations.pickups;
  const add = top && players.get(top.add_player_id);
  const drop = top?.drop_player_id != null ? players.get(top.drop_player_id) : undefined;
  const later = data.meta.adds_effective_date && data.meta.adds_effective_date > data.meta.today;

  return (
    <Card
      title="Free agency moves"
      aside={later ? <span className="muted" style={{ fontSize: 12 }}>Adds now count from {weekday(data.meta.adds_effective_date!)}</span> : null}
    >
      {!top || !add ? (
        <p className="muted">No free agent beats anyone on your roster this week.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <Link href={`/free-agents/${add.id}`} className="swap" aria-label={`Why add ${add.name}`}>
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
              <small>proj. fpts this week</small>
            </div>
          </Link>
          <div className="chips">
            {(top.factors ?? []).slice(0, 3).map((f) => (
              <span className="reason-chip" key={f.key}>{f.label}</span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Meter c={top.confidence} />
            <Link href={`/free-agents/${add.id}`} className="btn" style={{ marginLeft: "auto" }}>See why</Link>
          </div>
          {rest.length > 0 && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <p className="section-label">Other options · 1 add per day</p>
              {rest.map((x) => {
                const p = players.get(x.add_player_id);
                const d = x.drop_player_id != null ? players.get(x.drop_player_id) : undefined;
                if (!p) return null;
                return (
                  <Link href={`/free-agents/${p.id}`} className="option" key={p.id}>
                    <Photo p={p} size={34} round />
                    <div className="who">
                      <b style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</b>
                      <small>{p.nba_team} · {p.primary_position}{d ? ` · drop ${lastName(d.name)}` : ""}</small>
                    </div>
                    <span className="num" style={{ fontSize: 18, color: "var(--pos)" }}>{signed(x.gain_this_week)}</span>
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
