// A reasoning chip: one piece of evidence behind a recommendation.
// Direction means "for or against the player's outlook", not "number went up":
// a falling turnover count would be "up". Shape (▲ ▼ –) carries it, colour only reinforces it.
import type { Direction, Factor } from "@/lib/ontology";

const TONE: Record<Direction, string> = {
  up: "border-up-line bg-up-soft",
  down: "border-down-line bg-down-soft",
  neutral: "border-line bg-surface",
};

const SR: Record<Direction, string> = {
  up: "supports",
  down: "works against",
  neutral: "neutral",
};

export function DirectionGlyph({ direction }: { direction: Direction }) {
  if (direction === "neutral")
    return (
      <svg aria-hidden viewBox="0 0 8 8" className="h-2 w-2 text-ink-3">
        <rect x="1" y="3.25" width="6" height="1.5" rx="0.75" fill="currentColor" />
      </svg>
    );
  return (
    <svg
      aria-hidden
      viewBox="0 0 8 8"
      className={`h-2 w-2 ${direction === "up" ? "text-up" : "rotate-180 text-down"}`}
    >
      <path d="M4 1 7.2 6.5H.8z" fill="currentColor" />
    </svg>
  );
}

/** "21.1 vs 19.5": the comparison baseline is shown quieter than the headline number. */
function FactorValue({ value }: { value: string }) {
  const [now, base] = value.split(/\s+vs\.?\s+/);
  if (base === undefined) return <>{value}</>;
  return (
    <>
      {now}
      <span className="font-normal text-ink-3">vs {base}</span>
    </>
  );
}

export function FactorChip({ factor }: { factor: Factor }) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs ${TONE[factor.direction]}`}
    >
      <span className="text-ink-2">{factor.label}</span>
      <span className="inline-flex items-center gap-1 font-mono font-medium text-ink">
        <FactorValue value={factor.value} />
        <DirectionGlyph direction={factor.direction} />
      </span>
      <span className="sr-only">({SR[factor.direction]})</span>
    </span>
  );
}

export function FactorChips({ factors }: { factors: Factor[] }) {
  if (!factors.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {factors.map((f, i) => (
        <FactorChip key={`${f.label}-${i}`} factor={f} />
      ))}
    </div>
  );
}
