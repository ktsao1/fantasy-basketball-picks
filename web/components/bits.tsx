import type { Confidence, Player } from "@/lib/types";
import { injury } from "@/lib/format";

export function ConfidenceTag({ c }: { c: Confidence }) {
  return (
    <span className={`conf conf-${c.level}`} title={c.basis}>
      {c.level} confidence <span className="muted">· {c.basis}</span>
    </span>
  );
}

/** A recommendation's why: the one-line reason and its confidence, always together. */
export function Why({ reason, confidence }: { reason: string; confidence: Confidence }) {
  return (
    <div className="why">
      <div>{reason}</div>
      <ConfidenceTag c={confidence} />
    </div>
  );
}

export function PlayerName({ p }: { p: Player | undefined }) {
  if (!p) return <span className="muted">Unknown player</span>;
  const inj = injury(p);
  return (
    <span>
      <strong>{p.name}</strong> <span className="muted">{p.nba_team}</span>
      {inj && <span className="injury"> {inj}</span>}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="muted empty">{children}</p>;
}
