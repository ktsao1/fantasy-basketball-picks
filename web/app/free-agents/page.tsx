"use client";

import { useState } from "react";
import { Empty, PlayerName, Why } from "@/components/bits";
import { useData } from "@/lib/data";
import { day, fmt, positions, signed, splitAvg, unavailable } from "@/lib/format";

const POSITIONS = ["All", "PG", "SG", "SF", "PF", "C"];

export default function FreeAgentsPage() {
  const { data, players } = useData();
  const [pos, setPos] = useState("All");
  if (!data) return null;
  const pickups = data.recommendations.pickups;
  const adds = data.meta.adds_effective_date;

  const pool = data.players
    .filter((p) => p.owner == null)
    .filter((p) => pos === "All" || p.positions.includes(pos))
    // Best per-game projection first; injured players sink to the bottom.
    .sort((a, b) => Number(unavailable(a)) - Number(unavailable(b)) ||
      (b.projection.engine_fpts_per_game ?? 0) - (a.projection.engine_fpts_per_game ?? 0));

  return (
    <>
      <h1>Free agents</h1>
      <p className="muted">
        One add per day in this league{adds ? `; an add made now counts from ${day(adds)}` : ""}. Each suggestion is
        the best swap for that player, so they&rsquo;re alternatives, not a to-do list.
      </p>

      <h2>Top pickups</h2>
      {pickups.length === 0 ? (
        <Empty>No free agent beats anyone on your roster right now.</Empty>
      ) : (
        <ol className="list">
          {pickups.map((x) => (
            <li key={x.add_player_id}>
              <div className="title">
                Add <PlayerName p={players.get(x.add_player_id)} />
                {x.drop_player_id != null && (
                  <>
                    , drop <PlayerName p={players.get(x.drop_player_id)} />
                  </>
                )}
              </div>
              <div className="muted">
                {signed(x.gain_this_week)} fpts this week · {signed(x.gain_rest_of_season, 0)} rest of season
              </div>
              <Why reason={x.reason} confidence={x.confidence} />
            </li>
          ))}
        </ol>
      )}

      <h2>
        All tracked free agents{" "}
        <span className="muted">
          ({pool.length}
          {pos === "All" ? `, top ${data.meta.free_agent_count} by % owned` : ""})
        </span>
      </h2>
      <label>
        Position{" "}
        <select value={pos} onChange={(e) => setPos(e.target.value)}>
          {POSITIONS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th className="num">Proj / game</th>
              <th className="num">Season</th>
              <th className="num">Last 15</th>
              <th className="num">Games left</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pool.map((p) => (
              <tr key={p.id}>
                <td>
                  <PlayerName p={p} />
                </td>
                <td>{positions(p)}</td>
                <td className="num">{fmt(p.projection.engine_fpts_per_game)}</td>
                <td className="num">{fmt(splitAvg(p.stats.season))}</td>
                <td className="num">{fmt(splitAvg(p.stats.last_15))}</td>
                <td className="num">{p.games_left_this_week}</td>
                <td>{p.free_agent_status === "WAIVERS" ? <span className="tag">Waivers</span> : <span className="tag">Free agent</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
