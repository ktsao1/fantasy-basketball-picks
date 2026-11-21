"use client";

import Link from "next/link";
import { useState } from "react";
import { Empty, Games, Photo, Tag } from "@/components/ui";
import { useData } from "@/lib/data";
import { fmt, signed, unavailable } from "@/lib/format";
import { pickupFor } from "@/lib/view";

const POSITIONS = ["All", "PG", "SG", "SF", "PF", "C"];
const PAGE = 12;

export default function FreeAgentsPage() {
  const { data, players } = useData();
  const [pos, setPos] = useState("All");
  const [shown, setShown] = useState(PAGE);
  if (!data) return null;

  const top = data.recommendations.pickups[0];
  const best = top && players.get(top.add_player_id);
  const pool = data.players
    .filter((p) => p.owner == null)
    .filter((p) => pos === "All" || p.positions.includes(pos))
    // Recommended adds first, then this week's projection; injured players sink to the bottom.
    .sort((a, b) => {
      const ra = pickupFor(data, a.id)?.rank ?? 99, rb = pickupFor(data, b.id)?.rank ?? 99;
      return Number(unavailable(a)) - Number(unavailable(b)) || ra - rb ||
        (b.projection.engine_week_fpts ?? 0) - (a.projection.engine_week_fpts ?? 0);
    });

  return (
    <div className="stack" style={{ gap: 22 }}>
      {best ? (
        <Link href={`/free-agents/${best.id}`} className="band fa-band on-dark">
          <Photo p={best} w={96} h={72} />
          <h1 className="band-title">{best.name} is the best add this week.</h1>
          <div className="total">
            <span className="num">{fmt(best.projection.engine_week_fpts)}</span>
            <span className="band-label">Proj. pts this week</span>
          </div>
        </Link>
      ) : (
        <h1 className="page-title">Free agents</h1>
      )}

      <div className="chips" role="group" aria-label="Position">
        {POSITIONS.map((p) => (
          <button key={p} className="chip" aria-pressed={pos === p} onClick={() => { setPos(p); setShown(PAGE); }}>{p}</button>
        ))}
      </div>

      {pool.length === 0 ? (
        <Empty>No tracked free agents at {pos}.</Empty>
      ) : (
        <div className="grid">
          {pool.slice(0, shown).map((p) => {
            const rec = pickupFor(data, p.id);
            const isTop = rec?.rank === 0;
            const out = unavailable(p);
            return (
              <Link href={`/free-agents/${p.id}`} key={p.id} className={`fa-card${isTop ? " top" : ""}`}>
                <Photo p={p} dim={out} />
                <div className="fa-card-body">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{p.name}</b>
                      <small>{p.nba_team} · {p.primary_position}{p.free_agent_status === "WAIVERS" ? " · Waivers" : ""}</small>
                    </div>
                    {isTop ? <Tag tone="rec">Top pick</Tag> : rec ? <Tag tone="rec-soft">Recommended</Tag> : out ? <Tag tone="neg">Out</Tag> : p.injury_status === "DAY_TO_DAY" ? <Tag tone="warn">Day-to-day</Tag> : null}
                  </div>
                  <div className="fa-stat">
                    <div>
                      <span className="num">{fmt(p.projection.engine_week_fpts)}</span>
                      <small>proj. pts this week</small>
                    </div>
                    <Games n={p.games_left_this_week} of={Math.max(3, p.games_left_this_week)} />
                  </div>
                  {rec && (
                    <small style={{ color: "var(--pos)", fontWeight: 600 }}>
                      {signed(rec.pickup.gain_this_week)} fpts this week if added
                    </small>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {pool.length > shown && (
        <div className="more">
          <button className="chip" onClick={() => setShown(shown + PAGE)}>Show more ({pool.length - shown})</button>
        </div>
      )}
    </div>
  );
}
