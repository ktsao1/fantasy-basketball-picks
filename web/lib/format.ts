import type { Player, StatLine } from "./types";

export function fmt(n: number | null | undefined, digits = 1): string {
  return n == null ? "—" : n.toFixed(digits);
}

export function signed(n: number | null | undefined, digits = 1): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
}

/** "Fri Nov 20" from an ISO date (YYYY-MM-DD), read as a calendar date, not a UTC instant. */
export function day(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function timestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

const INJURY: Record<string, string> = {
  ACTIVE: "",
  DAY_TO_DAY: "Day-to-day",
  OUT: "Out",
  QUESTIONABLE: "Questionable",
  PROBABLE: "Probable",
  DOUBTFUL: "Doubtful",
  SUSPENSION: "Suspended",
  INJURY_RESERVE: "IR",
};

export function injury(p: Player): string {
  if (!p.injury_status) return "";
  return INJURY[p.injury_status] ?? p.injury_status.replace(/_/g, " ").toLowerCase();
}

/** Fantasy-eligible positions, without ESPN's combo and utility slots. */
export function positions(p: Player): string {
  return p.positions.filter((x) => ["PG", "SG", "SF", "PF", "C"].includes(x)).join(", ");
}

/** Expected fpts for the rest of the week, from the engine (injury status and back-to-backs applied). */
export function weekProjection(p: Player): number | null {
  return p.projection.engine_week_fpts ?? null;
}

/** A split's fpts average, or null when he hasn't played in it (so it shows "—", not 0.0). */
export function splitAvg(line: StatLine | undefined): number | null {
  return line && (line.gp ?? 0) > 0 ? line.fpts_avg : null;
}

const UNAVAILABLE = new Set(["OUT", "INJURY_RESERVE", "SUSPENSION"]);
export function unavailable(p: Player): boolean {
  return UNAVAILABLE.has(p.injury_status ?? "");
}
