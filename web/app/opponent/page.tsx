"use client";

import { RosterTable } from "@/components/RosterTable";
import { useData } from "@/lib/data";
import { fmt, unavailable } from "@/lib/format";

export default function OpponentPage() {
  const { data } = useData();
  if (!data) return null;
  const opp = data.opponent;

  if (!opp) {
    return (
      <>
        <h1>Opponent</h1>
        <p className="banner banner-info">Bye week: no opponent this week.</p>
      </>
    );
  }

  const expected = data.recommendations.matchup_projection?.opponent;
  const gamesLeft = opp.roster.reduce((s, r) => {
    const p = data.players.find((x) => x.id === r.player_id);
    return s + (r.lineup_slot === "IR" || !p || unavailable(p) ? 0 : p.games_left_this_week);
  }, 0);

  return (
    <>
      <h1>{opp.name}</h1>
      <p className="muted">
        {opp.wins}-{opp.losses}
        {opp.ties ? `-${opp.ties}` : ""} · {gamesLeft} games left this week from healthy players
        {expected != null && ` · projected to finish the week at ${fmt(expected, 0)}`}
        {data.meta.anonymized && " · other managers' team names are hidden for this demo"}
      </p>
      <RosterTable team={opp} />
    </>
  );
}
