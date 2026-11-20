"use client";

import { PlayerName } from "@/components/bits";
import { useData } from "@/lib/data";
import { fmt, positions, splitAvg, weekProjection } from "@/lib/format";
import type { Team } from "@/lib/types";

const SLOT_ORDER = ["PG", "SG", "SF", "PF", "C", "G", "F", "UT", "BE", "IR"];

/** A team's roster with this week's outlook. Used by Matchup and Opponent. */
export function RosterTable({ team }: { team: Team }) {
  const { players } = useData();
  const rows = [...team.roster].sort(
    (a, b) => SLOT_ORDER.indexOf(a.lineup_slot ?? "BE") - SLOT_ORDER.indexOf(b.lineup_slot ?? "BE"),
  );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Slot</th>
            <th>Player</th>
            <th>Pos</th>
            <th className="num">Proj / game</th>
            <th className="num">Last 15</th>
            <th className="num">Games left</th>
            <th className="num" title="Expected fpts from his remaining games this week, after injury status">Week proj</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = players.get(r.player_id);
            return (
              <tr key={r.player_id} className={r.lineup_slot === "IR" ? "dim" : undefined}>
                <td>{r.lineup_slot ?? "—"}</td>
                <td>
                  <PlayerName p={p} />
                </td>
                <td>{p ? positions(p) : "—"}</td>
                <td className="num">{fmt(p?.projection.engine_fpts_per_game)}</td>
                <td className="num">{fmt(splitAvg(p?.stats.last_15))}</td>
                <td className="num">{p?.games_left_this_week ?? "—"}</td>
                <td className="num">{p ? fmt(weekProjection(p)) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
