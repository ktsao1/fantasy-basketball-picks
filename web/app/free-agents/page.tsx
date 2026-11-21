"use client";

import Link from "next/link";
import { useState } from "react";
import { Chevron, Empty, GameIcon, InfoPopup, Photo, Tag, usePageTitle, useQueryState } from "@/components/ui";
import { useData } from "@/lib/data";
import { dayShort, fmt, injury, lastName, signed, tip, unavailable, weekday } from "@/lib/format";
import type { Data, Player } from "@/lib/types";
import { addStart, addTiming, countableGames, countableProjection, countableSchedule, pickupFor, pickupValue, weeksLeft } from "@/lib/view";

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
  const cols: { key: SortKey; label: string; compact?: string; hideSm?: boolean }[] = [
    { key: "value", label: "Value" },
    { key: "gain", label: "Gain this week", compact: "Week gain", hideSm: sort === "ros" || sort === "proj" },
    { key: "ros", label: "Rest of season", compact: "Season gain", hideSm: sort !== "ros" },
    { key: "proj", label: `Proj. from ${from}`, hideSm: sort !== "proj" },
    { key: "games", label: "Games left", compact: "Games" },
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
        <label className="fa-sort">
          Sort by
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            {cols.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <p className="fa-count" aria-live="polite">Showing {shown.length} of {pool.length} players</p>
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
                  <th key={c.key} scope="col" className={`n fa-col-${c.key}${c.hideSm ? " hide-sm" : ""}`} aria-sort={sort === c.key ? "descending" : undefined}>
                    <span className="fa-column">
                      <button className="sort-button" onClick={() => setSort(c.key)}>
                        {c.compact ? <><span className="fa-wide-label">{c.label}</span><span className="fa-compact-label">{c.compact}</span></> : c.label}
                        <span className="sort-ind" aria-hidden><Chevron dir="down" /></span>
                      </button>
                      {c.key === "value" && (
                        <InfoPopup label="How Value is calculated" trigger={<span className="info-icon" aria-hidden>i</span>}>
                          <b>How Value is calculated</b>
                          <p>This week’s gain plus what a typical later week is worth (rest-of-season gain ÷ {weeksLeft(data)} weeks left). Value is used to rank recommended pickups.</p>
                        </InfoPopup>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const rec = pickupFor(data, p.id);
                const drop = rec?.pickup.drop_player_id != null ? players.get(rec.pickup.drop_player_id) : undefined;
                const out = unavailable(p);
                const status = injury(p);
                return (
                  <tr key={p.id} className={rec?.rank === 0 ? "top" : undefined}>
                    <td>
                      <div className="who-cell">
                        <Photo p={p} size={36} round dim={out} />
                        <div style={{ minWidth: 0 }}>
                          <div className="who-line">
                            <Link href={`/free-agents/${p.id}`}>{p.name}</Link>
                            {rec?.rank === 0 && <Tag tone="rec">Top pick</Tag>}
                            {status && <Tag tone={out ? "neg" : "warn"}>{status}</Tag>}
                          </div>
                          <small>{p.nba_team} · {p.primary_position}{p.free_agent_status === "WAIVERS" ? " · Waivers" : ""}</small>
                          {status && <small className={`fa-mobile-status ${out ? "out" : ""}`}>{status}</small>}
                        </div>
                      </div>
                    </td>
                    <td className="n">
                      {rec ? <span className="num value">{fmt(pickupValue(data, rec.pickup))}</span> : <span className="muted">—</span>}
                    </td>
                    <td className={`n${sort === "ros" || sort === "proj" ? " hide-sm" : ""}`}>
                      {rec ? (
                        <div className={`gain${rec.pickup.gain_this_week < 0 ? " loss" : ""}`}>
                          <span className="num">{signed(rec.pickup.gain_this_week)}</span>
                          {drop && drop.id !== bestDrop?.id && <small>drop {lastName(drop.name)}</small>}
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td className={`n${sort === "ros" ? "" : " hide-sm"}`}>{rec ? <span className="num">{signed(rec.pickup.gain_rest_of_season, 0)}</span> : <span className="muted">—</span>}</td>
                    <td className={`n${sort === "proj" ? "" : " hide-sm"}`}><span className="num">{fmt(countableProjection(data, p))}</span></td>
                    <td className="n fa-col-games"><Schedule data={data} player={p} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="fa-foot">Value is shown for qualifying swaps. A dash means a Value score is unavailable for that player.</p>
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

function Schedule({ data, player }: { data: Data; player: Player }) {
  const games = countableSchedule(data, player);
  return (
    <>
      <span className="games fa-games">
        {games.length === 0 && <span className="sr-only">No games left</span>}
        {games.map((game) => {
          const opponent = game.opponent ? `${game.home ? "vs" : "@"} ${game.opponent}` : "Opponent TBD";
          return (
            <InfoPopup key={game.date} label={`${player.name}, ${dayShort(game.date)}, ${opponent}`} trigger={<GameIcon />}>
              <b>{player.nba_team} {opponent}</b>
              <p>{dayShort(game.date)} · {tip(game.start_utc)}</p>
            </InfoPopup>
          );
        })}
        {Array.from({ length: Math.max(0, 3 - games.length) }, (_, i) => <GameIcon key={i} filled={false} />)}
      </span>
      <span className="fa-schedule-short">
        {games.length ? (
          <InfoPopup label={`${games.length} ${games.length === 1 ? "game" : "games"} left for ${player.name}`}
            trigger={<span className="fa-game-count"><GameIcon size={12} /> {games.length}</span>}>
            <b>{player.name}’s games left</b>
            <ul className="fa-game-list">
              {games.map((g) => <li key={g.date}>{dayShort(g.date)} · {g.opponent ? `${g.home ? "vs" : "@"} ${g.opponent}` : "Opponent TBD"} · {tip(g.start_utc)}</li>)}
            </ul>
          </InfoPopup>
        ) : <span aria-label="No games left">0</span>}
      </span>
    </>
  );
}
