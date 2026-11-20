"use client";
import { useState } from "react";
import { useApprovals } from "@/lib/approvals";
import type {
  LineupRecommendation,
  PickupRecommendation,
  RecommendationRun,
  WorldState,
} from "@/lib/ontology";
import { useRecommendations } from "@/lib/use-recommendations";
import { Briefing } from "./Briefing";
import { LineupList } from "./LineupList";
import { PickupCard } from "./PickupCard";

type Tab = "today" | "pickups" | "briefing";

function timeOf(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function SourceLabel({ run }: { run: RecommendationRun }) {
  if (run.source === "mock") return <>sample suggestions</>;
  if (run.source === "cached") return <>last good result · {timeOf(run.generatedAt)}</>;
  return <>Claude · {timeOf(run.generatedAt)}</>;
}

export function WarRoom({
  world,
  sample,
  previousAt,
}: {
  world: WorldState;
  /** Hand-written suggestions, passed only when the snapshot itself is mock data. */
  sample: RecommendationRun | null;
  previousAt: string | null;
}) {
  const [tab, setTab] = useState<Tab>("today");
  const { get, set } = useApprovals(world.league.snapshotAt);
  const { shown: run, status, error, rerun } = useRecommendations(world.league.snapshotAt, sample);
  const loading = status === "loading";

  const recs = run?.recommendations ?? [];
  const lineup = recs.filter((r): r is LineupRecommendation => r.kind === "lineup");
  const pickups = recs.filter((r): r is PickupRecommendation => r.kind === "pickup");
  const pending = (rs: { id: string }[]) => rs.filter((r) => get(r.id) === "pending").length;
  const decided = recs.length - pending(recs);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "today", label: "Today", count: pending(lineup) },
    { id: "pickups", label: "Pickups", count: pending(pickups) },
    { id: "briefing", label: "Briefing" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line">
        <nav className="-mb-px flex gap-5" aria-label="Screens">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex items-center gap-2 border-b-2 pb-2.5 text-sm transition-colors ${
                tab === t.id ? "border-accent font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              {t.label}
              {t.count ? (
                <span className="rounded-full bg-accent-soft px-1.5 font-mono text-[11px] leading-5 text-accent">
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3 pb-2 font-mono text-xs text-ink-3">
          {run && (
            <span>
              {decided}/{recs.length} decided · <SourceLabel run={run} />
            </span>
          )}
          <button
            onClick={() => void rerun()}
            disabled={loading}
            className="h-7 rounded-md border border-line bg-surface px-2.5 font-sans text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Analyzing…" : run ? "Re-run analysis" : "Run analysis"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-down-line bg-down-soft px-4 py-3 text-sm text-ink">
          <span className="font-medium text-down">Live analysis failed.</span> {error}{" "}
          <span className="text-ink-2">
            {run?.source === "cached"
              ? "Showing the last good result for this snapshot."
              : run?.source === "mock"
                ? "Showing the hand-written sample instead."
                : "Nothing to show yet; try again."}
          </span>
        </div>
      )}

      {!run && loading && <AnalyzingState rows={world.roster.length} />}

      {run && tab === "today" && <LineupList world={world} recs={lineup} approval={get} onDecide={set} />}

      {run &&
        tab === "pickups" &&
        (pickups.length ? (
          <div className="space-y-4">
            {pickups.map((r) => (
              <PickupCard key={r.id} rec={r} world={world} state={get(r.id)} onDecide={(s) => set(r.id, s)} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-surface px-5 py-6 text-sm text-ink-3">
            Nothing on the wire beats your roster this week.
          </p>
        ))}

      {run && tab === "briefing" && <Briefing lines={run.briefing} previousAt={previousAt} />}

      <p className="text-xs text-ink-3">
        Suggestions only. Approving records your decision here; make the move yourself in ESPN.
      </p>
    </div>
  );
}

function AnalyzingState({ rows }: { rows: number }) {
  return (
    <div aria-busy className="space-y-3">
      <p className="text-sm text-ink-2">
        Claude is reading the snapshot: {rows} roster players, free agents, injuries and this week&apos;s schedule.
        This usually takes under a minute.
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex gap-3 px-4 py-4">
            <span className="h-6 w-[4.75rem] animate-pulse rounded bg-bg" />
            <span className="flex-1 space-y-2">
              <span className="block h-4 w-1/3 animate-pulse rounded bg-bg" />
              <span className="block h-3.5 w-2/3 animate-pulse rounded bg-bg" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
