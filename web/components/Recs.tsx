"use client";

import Image from "next/image";
import Link from "next/link";
import { useData } from "@/lib/data";
import { lastName, monthDay, signed, weekday } from "@/lib/format";
import { addStart, countableGames, dropCaution, type DayView } from "@/lib/view";
import { Card, Photo, Tag } from "./ui";

/** Start/sit for the selected day: the moves to make on ESPN, or why none are needed. */
export function StartSit({ v }: { v: DayView }) {
  const { data } = useData();
  const n = v.moves.length;
  const when = v.date === data?.meta.today ? "tonight" : weekday(v.date);
  return (
    <Card title="Start / sit" aside={n > 0 && <Tag tone="rec-soft">{n} recommended {n === 1 ? "move" : "moves"}</Tag>}>
      {n === 0 ? (
        <p>No changes needed {when}.</p>
      ) : (
        <p>Make {n === 1 ? "this change" : `these ${n} changes`} on ESPN before tip-off {when}.</p>
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
export function FreeAgency() {
  const { data, players } = useData();
  if (!data) return null;
  const [top, ...rest] = data.recommendations.pickups.slice(0, 5);
  const add = top && players.get(top.add_player_id);
  const drop = top?.drop_player_id != null ? players.get(top.drop_player_id) : undefined;
  const caution = dropCaution(data, drop);
  const effective = add ? addStart(data, add) : data.meta.today;
  const addGames = add ? countableGames(data, add) : 0;
  const dropGames = drop?.game_dates_left?.filter((date) => date >= effective).length ?? 0;
  const addPPG = add?.projection.engine_fpts_per_game;
  const dropPPG = drop?.projection.engine_fpts_per_game;
  const recent = add?.stats.last_15?.fpts_avg;
  const season = add?.stats.season?.fpts_avg;
  const hot = recent != null && season != null && (add?.stats.last_15?.gp ?? 0) >= 3 && recent > season;

  return (
    <Card title="Free agency" className="today-free-agency">
      {!top || !add ? (
        <p className="muted">No free agent beats anyone on your roster this week.</p>
      ) : (
        <div className="today-pickup-content">
          <Link className="today-pickup-lead" href={`/free-agents/${add.id}`}>
            <Photo p={add} key={add.id} size={48} className="today-pickup-photo" />
            <span className="today-pickup-name"><b>{add.free_agent_status === "WAIVERS" ? "Claim" : "Add"} {add.name} <span className="today-pickup-arrow" aria-hidden>→</span></b>
              <small>Counts from {monthDay(effective)}{drop && ` · Drop ${drop.name}`}</small>
            </span>
            <span className="today-pickup-gain">
              <b className="num">{signed(top.gain_this_week)}</b>
              <small>proj. pts this week</small>
            </span>
          </Link>
          <ul className="today-pickup-factors" aria-label="Pickup factors">
            <li><Image src="/img/pickup/calendar.svg" width={16} height={16} alt="" unoptimized />
              {addGames} {addGames === 1 ? "game" : "games"}{drop && ` vs ${dropGames}`}
            </li>
            {addPPG != null && dropPPG != null && (
              <li><Image src="/img/pickup/bars.svg" width={16} height={16} alt="" unoptimized />{signed(addPPG - dropPPG)} ppg</li>
            )}
            {hot && <li><Image src="/img/pickup/trend.svg" width={16} height={16} alt="" unoptimized />Hot last 15 days</li>}
          </ul>
          {caution && <p className="caution">{caution}</p>}
          {rest.length > 0 && (
            <details className="today-pickup-alternatives" open>
              <summary className="section-label">Other options</summary>
              {rest.map((option) => {
                const player = players.get(option.add_player_id);
                const drop = option.drop_player_id == null ? undefined : players.get(option.drop_player_id);
                if (!player) return null;
                return (
                  <Link href={`/free-agents/${player.id}`} className="option" key={player.id}>
                    <Photo p={player} size={34} round />
                    <div className="who">
                      <b>{player.name}</b>
                      <small>{player.nba_team} · {player.primary_position}{drop && ` · drop ${lastName(drop.name)}`}</small>
                    </div>
                  </Link>
                );
              })}
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
