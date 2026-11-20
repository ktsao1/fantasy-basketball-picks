"use client";
// Approve / dismiss state, per recommendation id, in localStorage.
// Ids embed the snapshot timestamp, so a new snapshot starts every card at "pending".
import { useCallback } from "react";
import { createLocalStore } from "./local-store";
import type { ApprovalState } from "./ontology";

const store = createLocalStore<Record<string, ApprovalState>>("warroom:approvals:v1", {});

export function useApprovals(snapshotAt: string) {
  const map = store.useValue();

  const get = useCallback((id: string): ApprovalState => map[id] ?? "pending", [map]);

  const set = useCallback(
    (id: string, state: ApprovalState) => {
      // Keep only this snapshot's decisions so storage doesn't grow forever.
      const next: Record<string, ApprovalState> = {};
      for (const [k, v] of Object.entries(store.get())) if (k.startsWith(`${snapshotAt}:`)) next[k] = v;
      if (state === "pending") delete next[id];
      else next[id] = state;
      store.set(next);
    },
    [snapshotAt],
  );

  return { get, set };
}
