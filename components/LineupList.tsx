import type { ApprovalState, LineupRecommendation, Player, WorldState } from "@/lib/ontology";
import { FactorChips } from "./FactorChip";
import { ActionTag, ConfidenceMeter, DecisionControls, PlayerMeta } from "./bits";

const SLOT_ORDER = ["PG", "SG", "SF", "PF", "C", "G", "F", "UT", "BE", "IR"];
const GROUPS: { label: string; match: (slot: string) => boolean }[] = [
  { label: "Starters", match: (s) => !["BE", "IR"].includes(s) },
  { label: "Bench", match: (s) => s === "BE" },
  { label: "Injured reserve", match: (s) => s === "IR" },
];

function slotRank(p: Player) {
  const i = SLOT_ORDER.indexOf(p.lineupSlot ?? "BE");
  return i === -1 ? SLOT_ORDER.length : i;
}

export function LineupList({
  world,
  recs,
  approval,
  onDecide,
}: {
  world: WorldState;
  recs: LineupRecommendation[];
  approval: (id: string) => ApprovalState;
  onDecide: (id: string, s: ApprovalState) => void;
}) {
  const byPlayer = new Map(recs.map((r) => [r.playerId, r]));
  const roster = world.roster.map((id) => world.players[id]).sort((a, b) => slotRank(a) - slotRank(b));

  return (
    <div className="space-y-6">
      {GROUPS.map((g) => {
        const players = roster.filter((p) => g.match(p.lineupSlot ?? "BE"));
        if (!players.length) return null;
        return (
          <section key={g.label}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-ink-3">
              {g.label} <span className="font-mono">{players.length}</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {players.map((p) => (
                <LineupRow
                  key={p.id}
                  player={p}
                  world={world}
                  rec={byPlayer.get(p.id)}
                  approval={approval}
                  onDecide={onDecide}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function LineupRow({
  player,
  world,
  rec,
  approval,
  onDecide,
}: {
  player: Player;
  world: WorldState;
  rec?: LineupRecommendation;
  approval: (id: string) => ApprovalState;
  onDecide: (id: string, s: ApprovalState) => void;
}) {
  const state = rec ? approval(rec.id) : "pending";
  const dim = state === "dismissed" ? "opacity-50" : ""; // controls stay full strength so Undo is readable

  return (
    <li className={`grid grid-cols-[2.25rem_1fr] gap-x-3 px-4 py-3.5 sm:grid-cols-[2.25rem_4.75rem_1fr_auto]`}>
      <span className={`pt-1 font-mono text-xs text-ink-3 ${dim}`}>{player.lineupSlot}</span>

      <span className={`hidden pt-0.5 sm:block ${dim}`}>{rec && <ActionTag action={rec.action} />}</span>

      <div className={`min-w-0 space-y-1.5 ${dim}`}>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="sm:hidden">{rec && <ActionTag action={rec.action} />}</span>
          <span className="font-medium text-ink">{player.name}</span>
          <PlayerMeta player={player} team={world.proTeams[player.proTeam]} />
        </div>
        {rec ? (
          <>
            <p className="text-sm leading-snug text-ink-2">{rec.reason}</p>
            <FactorChips factors={rec.factors} />
          </>
        ) : (
          <p className="text-sm text-ink-3">No recommendation for this player.</p>
        )}
      </div>

      {rec && (
        <div className="col-start-2 mt-2.5 flex items-center gap-4 sm:col-start-auto sm:mt-0 sm:flex-col sm:items-end sm:justify-between sm:gap-2">
          <ConfidenceMeter confidence={rec.confidence} />
          <DecisionControls state={state} onChange={(s) => onDecide(rec.id, s)} />
        </div>
      )}
    </li>
  );
}
