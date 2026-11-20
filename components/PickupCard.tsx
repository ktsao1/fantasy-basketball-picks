import type { ApprovalState, PickupRecommendation, Player, WorldState } from "@/lib/ontology";
import { FactorChips } from "./FactorChip";
import { ActionTag, ConfidenceMeter, DecisionControls, PlayerMeta } from "./bits";

// Category columns for the side-by-side, compared over the last 15 days.
const CAT_COLS: { key: string; lowerIsBetter?: boolean; pct?: boolean }[] = [
  { key: "PTS" },
  { key: "REB" },
  { key: "AST" },
  { key: "STL" },
  { key: "BLK" },
  { key: "3PM" },
  { key: "FG%", pct: true },
  { key: "FT%", pct: true },
  { key: "TO", lowerIsBetter: true },
];

function fmt(v: number | null | undefined, pct?: boolean) {
  if (v == null) return "—";
  return pct ? v.toFixed(3).replace(/^0/, "") : v.toFixed(1);
}

type Col = { key: string; label: string; get: (p: Player, games: number) => number | null; lowerIsBetter?: boolean; pct?: boolean; int?: boolean };

function columns(world: WorldState): Col[] {
  const gp: Col = { key: "GP", label: "Gms", get: (_p, g) => g, int: true };
  if (world.league.scoring === "points") {
    return [
      gp,
      { key: "L7", label: "FPTS L7", get: (p) => p.form.last_7.fptsAvg },
      { key: "L15", label: "FPTS L15", get: (p) => p.form.last_15.fptsAvg },
      { key: "SZN", label: "FPTS Szn", get: (p) => p.form.season.fptsAvg },
      { key: "PROJ", label: "Proj", get: (p) => p.form.projected.fptsAvg },
    ];
  }
  return [
    gp,
    ...CAT_COLS.map((c) => ({ ...c, label: c.key, get: (p: Player) => p.form.last_15.cats?.[c.key] ?? null })),
  ];
}

export function PickupCard({
  rec,
  world,
  state,
  onDecide,
}: {
  rec: PickupRecommendation;
  world: WorldState;
  state: ApprovalState;
  onDecide: (s: ApprovalState) => void;
}) {
  const add = world.players[rec.addPlayerId];
  const drop = world.players[rec.dropPlayerId];
  const cols = columns(world);
  const dim = state === "dismissed" ? "opacity-50" : ""; // controls stay full strength so Undo is readable
  const games = (p: Player) => world.proTeams[p.proTeam]?.gamesNext7.length ?? 0;
  const rows = [
    { sign: "+", verb: "Add", p: add },
    { sign: "−", verb: "Drop", p: drop },
  ];

  return (
    <article className="rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <span className={dim}><ActionTag action="ADD_DROP" /></span>
        <h3 className={`text-sm text-ink ${dim}`}>
          Add <span className="font-medium">{add.name}</span>
          <span className="text-ink-3">, drop </span>
          <span className="font-medium">{drop.name}</span>
        </h3>
        <span className="ml-auto flex items-center gap-4">
          <ConfidenceMeter confidence={rec.confidence} />
          <DecisionControls state={state} onChange={onDecide} />
        </span>
      </header>

      <div className={`space-y-3 px-4 py-3.5 ${dim}`}>
        <p className="text-sm leading-snug text-ink-2">{rec.reason}</p>
        <FactorChips factors={rec.factors} />
      </div>

      <div className={`overflow-x-auto border-t border-line ${dim}`}>
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Add versus drop, last 15 days</caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-3">
              <th className="px-4 pb-1.5 pt-2.5 text-left font-medium">
                {world.league.scoring === "points" ? "Fantasy points" : "Last 15 days"}
              </th>
              {cols.map((c) => (
                <th key={c.key} className="px-2 pb-1.5 pt-2.5 text-right font-medium last:pr-4">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sign, verb, p }, ri) => {
              const other = rows[1 - ri].p;
              return (
                <tr key={verb} className="border-t border-line/70">
                  <td className="px-4 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className={`w-3 font-mono ${sign === "+" ? "text-up" : "text-down"}`} aria-label={verb}>
                        {sign}
                      </span>
                      <span className="whitespace-nowrap font-medium text-ink">{p.name}</span>
                    </div>
                    <div className="pl-5">
                      <PlayerMeta player={p} team={world.proTeams[p.proTeam]} />
                    </div>
                  </td>
                  {cols.map((c) => {
                    const v = c.get(p, games(p));
                    const o = c.get(other, games(other));
                    const better = v != null && o != null && v !== o && (c.lowerIsBetter ? v < o : v > o);
                    return (
                      <td
                        key={c.key}
                        className={`px-2 py-2 text-right font-mono tabular-nums last:pr-4 ${better ? "font-semibold text-ink" : "text-ink-3"}`}
                      >
                        {c.int ? (v ?? "—") : fmt(v, c.pct)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
