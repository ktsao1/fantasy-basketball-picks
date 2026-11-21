"use client";

import Link from "next/link";
import { Empty, Photo, Source, Tag, usePageTitle } from "@/components/ui";
import { useData, useTrackRecord } from "@/lib/data";
import { fmt, signed, weekday } from "@/lib/format";
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
  const days = [...new Set(graded.map((c) => c.date))].sort().reverse();
  const pendingDays = [...new Set(pending.map((c) => c.date))].sort();
  // One scale for every row, so ranges and misses compare at a glance.
  const max = Math.ceil(Math.max(...r.calls.map((c) => Math.max(c.range[1], c.actual ?? 0)), 10) / 10) * 10;
  const share = s.graded ? s.within_range / s.graded : 0;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="band tr-band on-dark" aria-label="Summary">
        <div className="tr-head">
          <h1 className="band-title">
            {s.graded ? `${s.within_range} of ${s.graded} start calls landed inside their 80% range.` : "Nothing graded yet."}
          </h1>
          <p className="band-sub">
            {s.days_graded.length} day{s.days_graded.length === 1 ? "" : "s"} graded so far, from {r.snapshots} saved pulls.
            {s.graded < 30 && " Too few to measure the engine yet; it grows every game day."}
          </p>
        </div>
        <dl className="tr-stats">
          <div>
            <dt>Inside the range</dt>
            <dd><span className="num">{Math.round(share * 100)}%</span><small>target 80%</small></dd>
          </div>
          <div>
            <dt>Average miss</dt>
            <dd><span className="num">{fmt(s.mean_abs_error)}</span><small>pts per player</small></dd>
          </div>
          <div>
            <dt>Projected vs scored</dt>
            <dd><span className="num">{fmt(s.projected_total, 0)} / {fmt(s.actual_total, 0)}</span><small>{s.bias != null ? `${signed(s.bias)} pts per player on average` : ""}</small></dd>
          </div>
        </dl>
      </section>

      <div className="tr-legend" aria-hidden>
        <span><i className="lg-range hatch" /> 80% range</span>
        <span><i className="lg-proj" /> Projection</span>
        <span><i className="lg-actual" /> Actual (ESPN)</span>
      </div>

      {days.map((d) => (
        <section className="card rows tr-day" key={d} aria-label={`${weekday(d)} calls`}>
          <div className="roster-head">
            <b>{weekday(d)}</b>
            <span className="muted" style={{ fontSize: 13 }}>{dayLine(graded.filter((c) => c.date === d))}</span>
            <span className="grow" />
            <Source kind="proj">Proj.</Source>
            <Source kind="espn">Actual</Source>
          </div>
          {graded.filter((c) => c.date === d).map((c) => <CallRow key={`${c.date}-${c.player_id}`} c={c} max={max} />)}
        </section>
      ))}

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

      {noScore.length > 0 && (
        <p className="muted" style={{ fontSize: 12 }}>
          Not graded: {noScore.map((c) => `${c.name} (${weekday(c.date)})`).join(", ")}. ESPN has no box score for{" "}
          {noScore.length === 1 ? "him" : "them"} that day, usually because he left the roster or didn&rsquo;t play.
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

function CallRow({ c, max }: { c: Call; max: number }) {
  const { players } = useData();
  const p = players.get(c.player_id) ?? { id: c.player_id, name: c.name };
  const a = c.actual!;
  const inside = a >= c.range[0] && a <= c.range[1];
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
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
      <div className="tr-strip" role="img" aria-label={`Projected ${fmt(c.projected)}, range ${fmt(c.range[0], 0)} to ${fmt(c.range[1], 0)}, scored ${fmt(a)}`}>
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
