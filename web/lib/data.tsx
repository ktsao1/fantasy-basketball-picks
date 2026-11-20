"use client";

// Loads the live JSON and the curated Replay snapshots, and holds the
// Live / Replay choice for every page.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Data, FeaturedEntry, Player } from "./types";

const STALE_MS = 24 * 60 * 60 * 1000;
const MODE_KEY = "fb-mode";

type Mode = "live" | "replay";

type Ctx = {
  status: "loading" | "error" | "ready";
  error?: string;
  live: Data | null;
  featured: FeaturedEntry[];
  mode: Mode;
  setMode: (m: Mode) => void;
  replayIndex: number;
  setReplayIndex: (i: number) => void;
  /** The dataset the pages should show: live, or the selected snapshot. */
  data: Data | null;
  liveIsStale: boolean;
  players: Map<number, Player>;
};

const DataContext = createContext<Ctx | null>(null);

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

function readStoredMode(): { mode: Mode; index: number } | null {
  try {
    const raw = sessionStorage.getItem(MODE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Ctx["status"]>("loading");
  const [error, setError] = useState<string>();
  const [live, setLive] = useState<Data | null>(null);
  const [featured, setFeatured] = useState<FeaturedEntry[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Data>>({});
  const [mode, setModeState] = useState<Mode>("live");
  const [replayIndex, setReplayIndexState] = useState(0);
  const [liveIsStale, setLiveIsStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [l, f] = await Promise.all([
          getJson<Data>("/data/latest.json"),
          getJson<FeaturedEntry[]>("/data/featured.json").catch(() => []),
        ]);
        const snaps: Record<string, Data> = {};
        await Promise.all(
          f.map(async (e) => {
            snaps[e.file] = await getJson<Data>(`/data/snapshots/${e.file}`);
          }),
        );
        if (cancelled) return;
        setLive(l);
        setFeatured(f);
        setSnapshots(snaps);

        // A choice made earlier in this tab wins; otherwise stale data defaults to Replay.
        const stored = readStoredMode();
        const stale = Date.now() - new Date(l.meta.updated_at).getTime() > STALE_MS;
        setLiveIsStale(stale);
        if (stored && (stored.mode === "live" || f.length > 0)) {
          setModeState(stored.mode);
          setReplayIndexState(Math.min(stored.index, Math.max(f.length - 1, 0)));
        } else if (stale && f.length > 0) {
          setModeState("replay");
        }
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
  }, []);

  const persist = useCallback((m: Mode, i: number) => {
    try {
      sessionStorage.setItem(MODE_KEY, JSON.stringify({ mode: m, index: i }));
    } catch {
      /* storage blocked: the choice just won't survive a reload */
    }
  }, []);

  const setMode = useCallback(
    (m: Mode) => {
      setModeState(m);
      persist(m, replayIndex);
    },
    [persist, replayIndex],
  );
  const setReplayIndex = useCallback(
    (i: number) => {
      setReplayIndexState(i);
      persist(mode, i);
    },
    [persist, mode],
  );

  const data =
    mode === "replay" && featured[replayIndex] ? snapshots[featured[replayIndex].file] ?? null : live;

  const players = useMemo(() => new Map((data?.players ?? []).map((p) => [p.id, p])), [data]);

  return (
    <DataContext.Provider
      value={{ status, error, live, featured, mode, setMode, replayIndex, setReplayIndex, data, liveIsStale, players }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData outside DataProvider");
  return ctx;
}
