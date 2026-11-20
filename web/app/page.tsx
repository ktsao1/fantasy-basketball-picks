"use client";

import { Empty, PlayerName, Why } from "@/components/bits";
import { useData } from "@/lib/data";
import { day, fmt } from "@/lib/format";
import type { LineupSlot } from "@/lib/types";

const ACTION_LABEL = { start: "Start", bench: "Bench", move: "Move" } as const;

export default function TodayPage() {
  const { data, players, mode } = useData();
  if (!data) return null;
  const recs = data.recommendations;
  const days = [...new Set(recs.lineup.map((l) => l.date).filter(Boolean))] as string[];
  const first = days[0];
  const later = days.slice(1);
  const byDay = (d: string) => recs.lineup.filter((l) => l.date === d);
  const firstTotal = first ? byDay(first).reduce((s, l) => s + (l.projected_fpts ?? 0), 0) : 0;

  return (
    <>
      <h1>Today</h1>
      <p className="muted">
        Recommended lineup for {data.my_team.name}, {mode === "replay" ? "as it looked in this saved snapshot" : "from live ESPN data"}.
        Lineups lock at each player&rsquo;s tip-off, so this is decided day by day. The tool only recommends; every
        move is made by hand on ESPN.
      </p>

      {!first ? (
        <Empty>No games left for your players this week.</Empty>
      ) : (
        <>
          <h2>
            Changes to make on ESPN {first !== data.meta.today && <span className="muted">· for {day(first)}</span>}
          </h2>
          {recs.changes.length === 0 ? (
            <p className="banner banner-info">
              No changes needed. Everyone with a game on {day(first)} is already starting.
            </p>
          ) : (
            <ul className="list">
              {recs.changes.map((c, i) => (
                <li key={i}>
                  <div className="title">
                    {ACTION_LABEL[c.action]} <PlayerName p={players.get(c.player_id)} />{" "}
                    <span className="muted">
                      {c.from_slot ?? "—"} → {c.to_slot ?? "—"}
                    </span>
                  </div>
                  <Why reason={c.reason} confidence={c.confidence} />
                </li>
              ))}
            </ul>
          )}

          <h2>
            Recommended lineup · {day(first)}{" "}
            <span className="muted">({fmt(firstTotal)} projected fpts)</span>
          </h2>
          <LineupTable slots={byDay(first)} />

          {later.length > 0 && (
            <>
              <h2>Rest of the week</h2>
              {later.map((d) => (
                <details key={d}>
                  <summary>
                    {day(d)}{" "}
                    <span className="muted">
                      ({fmt(byDay(d).reduce((s, l) => s + (l.projected_fpts ?? 0), 0))} projected fpts)
                    </span>
                  </summary>
                  <LineupTable slots={byDay(d)} />
                </details>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

function LineupTable({ slots }: { slots: LineupSlot[] }) {
  const { players } = useData();
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Slot</th>
            <th>Player</th>
            <th className="num">Proj</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((l) => (
            <tr key={l.slot} className={l.player_id == null ? "dim" : undefined}>
              <td>{l.slot.replace(/\d+$/, "")}</td>
              <td>{l.player_id == null ? "Empty" : <PlayerName p={players.get(l.player_id)} />}</td>
              <td className="num">{fmt(l.projected_fpts)}</td>
              <td>
                <Why reason={l.reason} confidence={l.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
