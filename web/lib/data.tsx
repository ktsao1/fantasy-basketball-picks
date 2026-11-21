"use client";

// Loads the latest league JSON for every page.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Data, Player, TrackRecord } from "./types";

const STALE_MS = 24 * 60 * 60 * 1000;

type Ctx = {
  status: "loading" | "error" | "ready";
  error?: string;
  data: Data | null;
  /** The last pull is more than a day old, so the ESPN connection may need reconnecting. */
  isStale: boolean;
  players: Map<number, Player>;
  /** Final fantasy points by day, then player id, from ESPN box scores. Empty until loaded or if missing. */
  actuals: Actuals;
  /** Each team's lineup on finished days. Empty until loaded or if missing. */
  lineups: Lineups;
  /** Fetch the league data again (the error state's "Try again"). */
  reload: () => void;
};

export type Actuals = Record<string, Record<string, number>>;
/** Day → team id → player id → where he sat that day (pipeline/track_record.py). */
export type Lineups = Record<string, Record<string, Record<string, { slot: string; name: string; nba_team: string }>>>;

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Ctx["status"]>("loading");
  const [error, setError] = useState<string>();
  const [data, setData] = useState<Data | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [actuals, setActuals] = useState<Actuals>({});
  const [lineups, setLineups] = useState<Lineups>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/latest.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`/data/latest.json: ${res.status}`);
        const d = (await res.json()) as Data;
        // Past days' results are optional: the dashboard still works without them.
        const optional = <T,>(path: string) =>
          fetch(path, { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null);
        const [a, l] = await Promise.all([optional<Actuals>("/data/actuals.json"), optional<Lineups>("/data/lineups.json")]);
        if (cancelled) return;
        setActuals(a ?? {});
        setLineups(l ?? {});
        setData(d);
        setIsStale(Date.now() - new Date(d.meta.updated_at).getTime() > STALE_MS);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = () => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  };

  const players = useMemo(() => new Map((data?.players ?? []).map((p) => [p.id, p])), [data]);

  return (
    <DataContext.Provider value={{ status, error, data, isStale, players, actuals, lineups, reload }}>{children}</DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData outside DataProvider");
  return ctx;
}

/** The graded record of past calls. Optional: null while loading, "none" if there isn't one yet. */
export function useTrackRecord(): TrackRecord | null | "none" {
  const [record, setRecord] = useState<TrackRecord | null | "none">(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/data/track_record.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : "none"))
      .then((d) => { if (!cancelled) setRecord(d); })
      .catch(() => { if (!cancelled) setRecord("none"); });
    return () => { cancelled = true; };
  }, []);
  return record;
}
