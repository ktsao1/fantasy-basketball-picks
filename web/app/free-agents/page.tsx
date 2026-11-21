"use client";

import Link from "next/link";
import { useState } from "react";
import { Chevron, Empty, Games, Photo, Tag, usePageTitle, useQueryState } from "@/components/ui";
import { useData } from "@/lib/data";
import { fmt, lastName, signed, unavailable, weekday } from "@/lib/format";
import type { Player } from "@/lib/types";
import { addStart, addTiming, countableGames, countableProjection, pickupFor, pickupValue, weeksLeft } from "@/lib/view";

const POSITIONS = ["All", "PG", "SG", "SF", "PF", "C"] as const;
const SORTS = ["value", "gain", "ros", "proj", "games"] as const;
type SortKey = (typeof SORTS)[number];

export default function FreeAgentsPage() {
  usePageTitle("Free agents");
  const { data, players } = useData();
  const [pos, setPos] = useQueryState("pos", "All", POSITIONS);
  const [sort, setSort] = useQueryState<SortKey>("sort", "value", SORTS);
  const [all, setAll] = useState(false);
  if (!data) return null;

  const from = weekday(addStart(data)).slice(0, 3);
  const cols: { key: SortKey; label: string; hideSm?: boolean }[] = [
    { key: "value", label: "Value" },
    { key: "gain", label: "Gain this week" },
    { key: "ros", label: "Rest of season", hideSm: true },
    { key: "proj", label: `Proj. from ${from}`, hideSm: true },
    { key: "games", label: `Games from ${from}`, hideSm: true },
  ];
  const top = data.recommendations.pickups[0];
  const best = top && players.get(top.add_player_id);
  const bestDrop = top?.drop_player_id != null ? players.get(top.drop_player_id) : undefined;
  // Players with no recommended swap sort after every recommended one, by their own projection.
  const tail = (p: Player) => -1000 + (countableProjection(data, p) ?? 0) / 1000;
  const key = (p: Player): number => {
    const rec = pickupFor(data, p.id)?.pickup;
    if (sort === "value") return rec ? pickupValue(data, rec) : tail(p);
    if (sort === "gain") return rec?.gain_this_week ?? tail(p);
    if (sort === "ros") return rec?.gain_rest_of_season ?? tail(p);
    if (sort === "proj") return countableProjection(data, p) ?? -1;
    return countableGames(data, p) + (countableProjection(data, p) ?? 0) / 1000;
  };
  const pool = data.players
    .filter((p) => p.owner == null)
    .filter((p) => pos === "All" || p.positions.includes(pos))
    .sort((a, b) => Number(unavailable(a)) - Number(unavailable(b)) || key(b) - key(a));
  const shown = all ? pool : pool.slice(0, 20);
  const sortLabel = cols.find((c) => c.key === sort)!.label.toLowerCase();

  return (
    <div className="stack" style={{ gap: 22 }}>
      {best ? (
        <Link href={`/free-agents/${best.id}`} className="band fa-band on-dark">
          <Photo p={best} w={96} h={72} />
          <div className="fa-band-text">
            <h1 className="band-title">{best.name} is the best add this week.</h1>
            <p className="band-sub">{bestDrop ? `Drop ${bestDrop.name}. ` : ""}{addTiming(data)}.</p>
          </div>
          <div className="total">
            <span className="num" style={{ color: "var(--pos-on-dark)" }}>{signed(top.gain_this_week)}</span>
            <span className="band-label">Proj. pts this week</span>
          </div>
        </Link>
      ) : (
        <h1 className="page-title">Free agents</h1>
      )}

      <div className="fa-controls">
        <div className="chips" role="group" aria-label="Position">
          {POSITIONS.map((p) => (
            <button key={p} className="chip" aria-pressed={pos === p} onClick={() => setPos(p)}>{p}</button>
          ))}
        </div>
        <p className="fa-legend">
          <b>Value</b> = this week&rsquo;s gain + what a typical later week is worth (rest of season ÷ {weeksLeft(data)} weeks left).
          The ranking uses it.
        </p>
      </div>

      {pool.length === 0 ? (
        <Empty>No tracked free agents at {pos}.</Empty>
      ) : (
        <div className="fa-table-wrap">
          <table className="fa-table">
            <caption className="sr-only">Free agents, sorted by {sortLabel}</caption>
            <thead>
              <tr>
                <th scope="col">Player</th>
                {cols.map((c) => (
                  <th key={c.key} scope="col" className={`n${c.hideSm ? " hide-sm" : ""}`} aria-sort={sort === c.key ? "descending" : "none"}>
                    <button onClick={() => setSort(c.key)}>
                      {c.label}
                      <span className="sort-ind" aria-hidden><Chevron dir="down" /></span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const rec = pickupFor(data, p.id);
                const drop = rec?.pickup.drop_player_id != null ? players.get(rec.pickup.drop_player_id) : undefined;
                const out = unavailable(p);
                return (
                  <tr key={p.id} className={rec?.rank === 0 ? "top" : rec ? "rec" : undefined}>
                    <td>
                      <div className="who-cell">
                        <Photo p={p} size={36} round dim={out} />
                        <div style={{ minWidth: 0 }}>
                          <div className="who-line">
                            <Link href={`/free-agents/${p.id}`}>{p.name}</Link>
                            {rec?.rank === 0 && <Tag tone="rec">Top pick</Tag>}
                            {out && <Tag tone="neg">Out</Tag>}
                            {!out && p.injury_status === "DAY_TO_DAY" && <Tag tone="warn">Day-to-day</Tag>}
                          </div>
                          <small>{p.nba_team} · {p.primary_position}{p.free_agent_status === "WAIVERS" ? " · Waivers" : ""}</small>
                        </div>
                      </div>
                    </td>
                    <td className="n">
                      {rec ? <span className="num value">{fmt(pickupValue(data, rec.pickup))}</span> : <span className="muted">—</span>}
                    </td>
                    <td className="n">
                      {rec ? (
                        <div className="gain">
                          <span className="num">{signed(rec.pickup.gain_this_week)}</span>
                          {drop && drop.id !== bestDrop?.id && <small>drop {lastName(drop.name)}</small>}
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td className="n hide-sm">{rec ? <span className="num" style={{ fontSize: 18 }}>{signed(rec.pickup.gain_rest_of_season, 0)}</span> : <span className="muted">—</span>}</td>
                    <td className="n hide-sm"><span className="num">{fmt(countableProjection(data, p))}</span></td>
                    <td className="n hide-sm"><Games n={countableGames(data, p)} of={Math.max(3, countableGames(data, p))} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="fa-foot">Only the engine&rsquo;s top {data.recommendations.pickups.length} swaps get a value; &ldquo;—&rdquo; means he isn&rsquo;t one of them this week.</p>
        </div>
      )}
      {!all && pool.length > shown.length && (
        <div className="more">
          <button className="chip" onClick={() => setAll(true)}>Show all {pool.length}</button>
        </div>
      )}
    </div>
  );
}
