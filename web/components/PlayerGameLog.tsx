"use client";

import { useEffect, useState } from "react";
import { Card, Empty } from "@/components/ui";
import { fmt, monthDay } from "@/lib/format";
import type { Data, PlayerGame } from "@/lib/types";

const COLUMNS = ["MIN", "PTS", "REB", "AST", "STL", "BLK", "3PM", "TO"] as const;

export function PlayerGameLog({ id, season, scoring }: { id: number; season: number; scoring: Data["meta"]["scoring_items"] }) {
  const url = `/api/game-log/${id}?season=${season}`;
  const [result, setResult] = useState<{ url: string; games: PlayerGame[] | null }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Game log unavailable");
        return response.json() as Promise<PlayerGame[]>;
      })
      .then((games) => setResult({ url, games }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ url, games: null });
      });
    return () => controller.abort();
  }, [url, attempt]);

  const games = result?.url === url ? result.games : undefined;
  return (
    <Card title="Last 10 games" sub="ESPN box scores · Fantasy points use your league’s scoring">
      {games === undefined && <p className="muted" role="status">Loading game log…</p>}
      {games === null && (
        <p className="muted">Game log unavailable. <button type="button" className="inline-button" onClick={() => {
          setResult(undefined);
          setAttempt((value) => value + 1);
        }}>Try again</button></p>
      )}
      {games?.length === 0 && <Empty>No games recorded this season.</Empty>}
      {!!games?.length && (
        <>
          <p className="game-log-hint">Scroll for more box-score stats</p>
          <div className="game-log-scroll" tabIndex={0} role="region" aria-label="Recent game stats">
            <table className="game-log-table">
              <thead>
                <tr>
                  <th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Fantasy pts</th>
                  {COLUMNS.map((stat) => <th key={stat} scope="col">{stat}</th>)}
                </tr>
              </thead>
              <tbody>
                {games.map((game) => {
                  const fantasy = scoring?.length && scoring.every(({ stat }) => game.stats[stat] != null)
                    ? scoring.reduce((sum, { stat, points }) => sum + game.stats[stat] * points, 0) : null;
                  return (
                    <tr key={game.id}>
                      <th scope="row">{monthDay(game.date)}</th>
                      <td title={game.opponentName ?? undefined}>{game.opponent ? `${game.home ? "vs" : "@"} ${game.opponent}` : "—"}</td>
                      <td className="num">{fmt(fantasy)}</td>
                      {COLUMNS.map((stat) => <td key={stat}>{game.stats[stat] ?? "—"}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
