"use client";

import Link from "next/link";
import { DateCalendar } from "@/components/DateCalendar";
import { Empty, Photo, Tag, useDay, usePageTitle } from "@/components/ui";
import { useData, useTrackRecord } from "@/lib/data";
import { dayShort, fmt, signed, weekday } from "@/lib/format";
import type { Call, TrackRecord } from "@/lib/types";

export default function TrackRecordPage() {
  usePageTitle("Track record");
  const record = useTrackRecord();
  if (record === null) return <p className="loading">Loading the track record…</p>;
  if (record === "none" || record.calls.length === 0) {
    return (
      <div className="stack">
        <h1 className="page-title">Track record</h1>
        <Empty>No calls have been graded yet. The first ones appear the morning after a game day.</Empty>
      </div>
    );
  }
  return <Record r={record} />;
}

function Record({ r }: { r: TrackRecord }) {
  const s = r.summary;
  const graded = r.calls.filter((c) => c.actual != null);
  const pending = r.calls.filter((c) => c.actual == null && (c.status ?? "pending") === "pending");
  const noScore = r.calls.filter((c) => c.status === "no_score");
  const days = [...new Set([...graded, ...noScore].map((c) => c.date))].sort().reverse();
  const [date, setDate] = useDay(days);
  const selected = graded.filter((call) => call.date === date);
  const ungraded = noScore.filter((call) => call.date === date);
  const pendingDays = [...new Set(pending.map((c) => c.date))].sort();
  // One scale for every row, so ranges and misses compare at a glance.
  const max = Math.ceil(Math.max(...graded.map((c) => Math.max(c.range[1], c.actual!, c.projected)), 10) / 10) * 10;
  const min = Math.floor(Math.min(...graded.map((c) => Math.min(c.range[0], c.actual!, c.projected)), 0) / 10) * 10;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="band tr-band on-dark" aria-label="Summary">
        <div className="tr-head">
          <h1 className="band-title">Track record</h1>
          <p className="band-sub">{s.graded ? `${s.graded} starter forecasts graded across ${s.days_graded.length} ${s.days_graded.length === 1 ? "day" : "days"}` : "Nothing graded yet"}</p>
        </div>
        <dl className="tr-stats">
          <div>
            <dt>Starter forecasts inside the 80% range</dt>
            <dd><span className="num">{s.graded ? `${s.within_range} of ${s.graded}` : "—"}</span>{!s.graded && <small>Awaiting results</small>}</dd>
          </div>
          <div>
            <dt>Average miss</dt>
            <dd><span className="num">{fmt(s.mean_abs_error)}</span><small>pts per player</small></dd>
          </div>
          <div>
            <dt>Projected vs scored</dt>
            <dd><span className="num">{s.graded ? `${fmt(s.projected_total, 0)} / ${fmt(s.actual_total, 0)}` : "—"}</span><small>{s.bias != null ? `Actual − projected: ${signed(s.bias)} pts/player` : ""}</small></dd>
          </div>
        </dl>
      </section>

      {date && (
        <section className="card rows tr-day" aria-label={`${dayShort(date)} calls`}>
          <div className="roster-head">
            <DateCalendar dates={days} date={date} onChange={setDate} label="Record date" />
            {selected.length > 0 && <span className="muted" style={{ fontSize: 13 }} aria-live="polite">{dayLine(selected)}</span>}
          </div>
          {selected.length ? selected.map((c) => <CallRow key={`${c.date}-${c.player_id}`} c={c} min={min} max={max} />)
            : <Empty>No calls could be graded for this day.</Empty>}
          {selected.length > 0 && (
            <div className="tr-legend" aria-hidden>
              <span><i className="lg-range hatch" /> 80% range</span>
              <span><i className="lg-proj" /> Projection</span>
              <span><i className="lg-actual" /> Actual (ESPN)</span>
            </div>
          )}
        </section>
      )}

      {pendingDays.length > 0 && (
        <section className="card" aria-label="Waiting on games">
          <div className="card-head"><h2 className="grow">Waiting on games</h2></div>
          <ul className="pending">
            {pendingDays.map((d) => {
              const cs = pending.filter((c) => c.date === d);
              return (
                <li key={d}>
                  <b>{weekday(d)}</b>
                  <span>{cs.length} {cs.length === 1 ? "call" : "calls"} · {fmt(cs.reduce((t, c) => t + c.projected, 0))} proj. pts</span>
                  <span className="pending-names">{cs.map((c) => c.name).join(", ")}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ungraded.length > 0 && (
        <p className="muted" style={{ fontSize: 12 }}>
          ESPN has no box score for {ungraded.map((c) => c.name).join(", ")} that day.
        </p>
      )}

      <section className="doc-note">
        <h2>How calls are graded</h2>
        <p>
          A call is the engine&rsquo;s last projection for a starter before his game tipped off, taken from the pulls saved
          every few hours. After the day&rsquo;s games, it&rsquo;s compared with the fantasy points ESPN&rsquo;s box score
          gives him. A call counts as inside the range when his actual points fall within the 80% range shown with it.{" "}
          <Link href="/how-it-works">How the projections work</Link>.
        </p>
      </section>
    </div>
  );
}

function dayLine(cs: Call[]): string {
  const proj = cs.reduce((t, c) => t + c.projected, 0);
  const act = cs.reduce((t, c) => t + (c.actual ?? 0), 0);
  return `${cs.length} starters · projected ${fmt(proj, 0)}, scored ${fmt(act, 0)}`;
}

function CallRow({ c, min, max }: { c: Call; min: number; max: number }) {
  const { players } = useData();
  const p = players.get(c.player_id) ?? { id: c.player_id, name: c.name };
  const a = c.actual!;
  const inside = a >= c.range[0] && a <= c.range[1];
  const pct = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const miss = a - c.projected;
  return (
    <div className="row tr-row">
      <span className="slot">{c.slot}</span>
      <Photo p={p} size={36} round />
      <div className="who">
        <div className="who-top">
          <strong>{c.name}</strong>
          {!inside && <Tag tone="warn">Outside range</Tag>}
        </div>
        <small>{c.nba_team}</small>
      </div>
      <div className="tr-strip" role="img" aria-label={`Projected ${fmt(c.projected)}, range ${fmt(c.range[0])} to ${fmt(c.range[1])}, scored ${fmt(a)}`}>
        <span className="tr-base" />
        <span className="tr-range hatch" style={{ left: pct(c.range[0]), width: `calc(${pct(c.range[1])} - ${pct(c.range[0])})` }} />
        <span className="tr-proj" style={{ left: pct(c.projected) }} />
        <span className={`tr-actual${inside ? "" : " out"}`} style={{ left: pct(a) }} />
      </div>
      <div className="tr-nums">
        <span><small>Proj.</small><span className="num">{fmt(c.projected)}</span></span>
        <span><small>Actual</small><span className="num">{fmt(a)}</span></span>
        <span className={miss >= 0 ? "up" : "down"}><small>Diff.</small><span className="num">{signed(miss)}</span></span>
      </div>
    </div>
  );
}
