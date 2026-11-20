import type { ApprovalState, Confidence, Player, ProTeam, RecommendationAction } from "@/lib/ontology";

const TAG: Record<RecommendationAction, string> = {
  START: "bg-accent text-white border-accent",
  MONITOR: "bg-accent-soft text-accent border-accent-soft",
  SIT: "bg-surface text-ink-2 border-line",
  ADD_DROP: "bg-accent text-white border-accent",
};

export function ActionTag({ action }: { action: RecommendationAction }) {
  return (
    <span
      className={`inline-flex h-6 w-[4.75rem] shrink-0 items-center justify-center rounded border font-mono text-[11px] font-semibold tracking-wider ${TAG[action]}`}
    >
      {action === "ADD_DROP" ? "ADD/DROP" : action}
    </span>
  );
}

const LEVEL: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

export function ConfidenceMeter({ confidence }: { confidence: Confidence }) {
  const n = LEVEL[confidence];
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-2" title={`${confidence} confidence`}>
      <span aria-hidden className="flex items-end gap-[3px]">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-[3px] rounded-sm ${i <= n ? "bg-ink-2" : "bg-line"}`}
            style={{ height: 4 + i * 3 }}
          />
        ))}
      </span>
      <span className="capitalize">{confidence}</span>
      <span className="sr-only">confidence</span>
    </span>
  );
}

export function DecisionControls({
  state,
  onChange,
}: {
  state: ApprovalState;
  onChange: (s: ApprovalState) => void;
}) {
  if (state !== "pending") {
    return (
      <span className="inline-flex h-8 items-center gap-3 text-xs">
        <span className={state === "approved" ? "font-medium text-up" : "text-ink-2"}>
          {state === "approved" ? "✓ Approved" : "Overridden"}
        </span>
        <button
          onClick={() => onChange("pending")}
          className="text-ink-3 underline-offset-2 hover:text-ink hover:underline"
        >
          Undo
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex gap-1.5">
      <button
        onClick={() => onChange("approved")}
        className="h-8 rounded-md border border-ink/25 bg-surface px-3 text-xs font-medium text-ink hover:border-ink hover:bg-ink hover:text-white"
      >
        Approve
      </button>
      <button
        onClick={() => onChange("dismissed")}
        className="h-8 rounded-md px-2.5 text-xs font-medium text-ink-2 hover:bg-bg hover:text-ink"
      >
        Override
      </button>
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  DAY_TO_DAY: "DTD",
  OUT: "OUT",
  INJURY_RESERVE: "IR",
  SUSPENSION: "SUSP",
  UNKNOWN: "?",
};

/** "IND · PG · 3 gms" plus an injury flag when the player isn't fully active. */
export function PlayerMeta({ player, team }: { player: Player; team?: ProTeam }) {
  const games = team?.gamesNext7.length ?? 0;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
      <span>{player.proTeam}</span>·<span>{player.position}</span>·
      <span title={team?.gamesNext7.join(", ")}>{games} gms</span>
      {player.injury.status !== "ACTIVE" && (
        <span className="ml-1 rounded-sm bg-down-soft px-1 font-mono text-[10px] font-semibold text-down">
          {STATUS_LABEL[player.injury.status]}
        </span>
      )}
    </span>
  );
}
