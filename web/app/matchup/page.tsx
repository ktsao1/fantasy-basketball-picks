"use client";

import { RosterTable } from "@/components/RosterTable";
import { useData } from "@/lib/data";
import { day, fmt, signed } from "@/lib/format";

export default function MatchupPage() {
  const { data } = useData();
  if (!data) return null;
  const m = data.matchup;
  const proj = data.recommendations.matchup_projection ?? m.projected ?? null;
  const days = data.meta.matchup_days;
  const opp = data.opponent;
  const edge = proj?.mine != null && proj?.opponent != null ? proj.mine - proj.opponent : null;

  return (
    <>
      <h1>Matchup · week {m.matchup_period}</h1>
      <p className="muted">
        {days.length > 0 && `${day(days[0])} – ${day(days[days.length - 1])}. `}
        Points league: each player&rsquo;s fantasy points count only on days he starts. Projections assume both teams set
        their best lineup every remaining day.
      </p>

      {m.is_bye || !opp ? (
        <p className="banner banner-info">Bye week: no opponent this week.</p>
      ) : (
        <div className="cards">
          <div className="card">
            <div className="label">{data.my_team.name} · so far</div>
            <div className="value">{fmt(m.my_score, 0)}</div>
          </div>
          <div className="card">
            <div className="label">{opp.name} · so far</div>
            <div className="value">{fmt(m.opponent_score, 0)}</div>
          </div>
          <div className="card">
            <div className="label">Projected final</div>
            <div className="value">
              {fmt(proj?.mine, 0)} – {fmt(proj?.opponent, 0)}
            </div>
          </div>
          <div className="card">
            <div className="label">Projected margin</div>
            <div className="value">{signed(edge, 0)}</div>
            <div className="muted">{edge == null ? "" : edge >= 0 ? "You're projected to win" : "You're projected to lose"}</div>
          </div>
        </div>
      )}

      <h2>Your roster this week</h2>
      <RosterTable team={data.my_team} />
    </>
  );
}
