"use client";
// Fetches a live run from /api/recommend and keeps the last good one in localStorage.
// If a call fails, the screens keep showing the last good result, marked as cached.
import { useCallback, useEffect, useState } from "react";
import { createLocalStore } from "./local-store";
import type { RecommendationRun } from "./ontology";

const lastGood = createLocalStore<RecommendationRun | null>("warroom:last-run:v1", null);

type Status = "idle" | "loading";

export function useRecommendations(snapshotAt: string, sample: RecommendationRun | null) {
  const stored = lastGood.useValue();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // A stored run is only usable if it was made from this snapshot: its ids and
  // player links come from that snapshot.
  const cached = stored && stored.snapshotAt === snapshotAt ? stored : null;

  const run = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/recommend", { method: "POST" });
      const body = await res.json().catch(() => ({ ok: false, error: `Server returned ${res.status}` }));
      if (!res.ok || !body.ok) throw new Error(body.error ?? `Server returned ${res.status}`);
      lastGood.set(body.run as RecommendationRun);
    } catch (e) {
      setError((e as Error).message || "The request failed.");
    } finally {
      setStatus("idle");
    }
  }, []);

  // First visit for this snapshot: run once automatically. Scheduled (not called
  // inline) so the effect doesn't set state synchronously; the cleanup also makes
  // React's dev double-mount start only one request.
  useEffect(() => {
    const s = lastGood.get();
    if (s && s.snapshotAt === snapshotAt) return;
    const t = setTimeout(() => void run(), 0);
    return () => clearTimeout(t);
  }, [snapshotAt, run]);

  // What the screens show: the live/cached result; if there is none and the call
  // failed, the hand-written sample (passed in only when the snapshot is mock data).
  let shown: RecommendationRun | null = cached;
  if (shown && error) shown = { ...shown, source: "cached", error };
  if (!shown && sample && error) shown = { ...sample, error };

  return { shown, status, error, rerun: run, hasLive: !!cached };
}
