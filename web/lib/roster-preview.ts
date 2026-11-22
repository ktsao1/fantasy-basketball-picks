import type { Data, Player, RosterEntry } from "./types";
import { addStart, playerLocked, playerPoints, slotType, type SideDay } from "./view";

type Transaction = { date: string; add?: number; drop?: number };
type Move = { player: number; slot: string | null };

export type RosterPreview = {
  transactions: Transaction[];
  moves: Record<string, Move[]>;
};

export const emptyRosterPreview: RosterPreview = { transactions: [], moves: {} };

export function rosterSlots(data: Data): string[] {
  return Object.entries(data.meta.roster_slots).flatMap(([slot, count]) => (
    slot === "BE" || slot === "IR" ? [] : Array.from({ length: count }, (_, i) => count > 1 ? `${slot}${i + 1}` : slot)
  ));
}

export function rosterThrough(data: Data, transactions: Transaction[], date: string): RosterEntry[] {
  const roster = new Map(data.my_team.roster.map((entry) => [entry.player_id, entry]));
  for (const move of transactions) {
    if (move.date > date) continue;
    if (move.drop !== undefined) roster.delete(move.drop);
    if (move.add !== undefined) roster.set(move.add, { player_id: move.add, lineup_slot: "BE" });
  }
  return [...roster.values()];
}

/** The roster and lineup resulting from the preview for one selected day. */
export function previewDay(data: Data, players: Map<number, Player>, preview: RosterPreview, date: string, recommended: boolean, asOf: number): SideDay {
  const roster = rosterThrough(data, preview.transactions, date);
  const eligible = new Map(roster.filter((r) => r.lineup_slot !== "IR").map((r) => [r.player_id, r]));
  const slots = rosterSlots(data);
  const assigned = new Map<string, number>();

  // Keep synced assignments for locked starters before applying any recommendations or overrides.
  for (const entry of eligible.values()) {
    if (!entry.lineup_slot || entry.lineup_slot === "BE") continue;
    const slot = slots.find((candidate) => !assigned.has(candidate) && slotType(candidate) === slotType(entry.lineup_slot!));
    if (slot) assigned.set(slot, entry.player_id);
  }
  const locked = new Set([...eligible.keys()].filter((id) => {
    const player = players.get(id);
    return player && playerLocked(data, player, date, asOf);
  }));
  const originalSlots = data.recommendations.lineup.filter((row) => row.date === date);
  const projections = new Map(originalSlots.map((row) => [row.player_id, row.projected_fpts]));
  if (recommended) {
    for (const [slot, id] of assigned) if (!locked.has(id)) assigned.delete(slot);
    const effective = preview.transactions.filter((move) => move.date <= date);
    const swap = effective.length === 1 ? effective[0] : undefined;
    const pickup = swap && data.recommendations.pickups.find((option) =>
      option.add_player_id === swap.add && option.drop_player_id === swap.drop);
    const recommendedSlots = pickup?.lineup_preview?.[date] ?? originalSlots;
    for (const row of recommendedSlots) {
      const id = row.player_id;
      if (id == null || !eligible.has(id) || locked.has(id) || assigned.has(row.slot)) continue;
      assigned.set(row.slot, id);
      projections.set(id, row.projected_fpts ?? null);
    }
  }

  for (const move of preview.moves[date] ?? []) {
    const player = players.get(move.player);
    if (!player || !eligible.has(move.player) || locked.has(move.player)) continue;
    if (move.slot && (!slots.includes(move.slot) || !player.positions.includes(slotType(move.slot)))) continue;
    const occupant = move.slot ? assigned.get(move.slot) : undefined;
    if (occupant !== undefined && locked.has(occupant)) continue;
    for (const [slot, id] of assigned) if (id === move.player) assigned.delete(slot);
    if (move.slot) assigned.set(move.slot, move.player);
  }

  const rows = slots.flatMap((slot) => {
    const id = assigned.get(slot);
    const player = id === undefined ? undefined : players.get(id);
    if (!player) return [];
    return [playerPoints(data, player, date, asOf, slot, projections.get(player.id))];
  });
  const on = new Set(rows.map((row) => row.player.id));
  const off = roster.flatMap(({ player_id }) => {
    const player = players.get(player_id);
    return player && !on.has(player_id) ? [player] : [];
  });
  return { rows, off, available: true, total: rows.reduce((sum, row) => sum + (row.value ?? row.scored ?? 0), 0) };
}

export function transactionDate(data: Data, selectedDate: string, add?: Player): string {
  const earliest = addStart(data, add);
  return selectedDate > earliest ? selectedDate : earliest;
}

export function stageTransaction(data: Data, players: Map<number, Player>, preview: RosterPreview, move: Transaction) {
  const transactions = [...preview.transactions, move].sort((a, b) => a.date.localeCompare(b.date));
  const roster = new Map(data.my_team.roster.map((entry) => [entry.player_id, entry.lineup_slot]));
  const capacity = Object.entries(data.meta.roster_slots).reduce((sum, [slot, count]) => sum + (slot === "IR" ? 0 : count), 0);
  for (const change of transactions) {
    if (change.drop !== undefined && !roster.delete(change.drop)) return { error: "That player is already off the preview roster on this date." };
    if (change.add === undefined) continue;
    const player = players.get(change.add);
    if (!player || player.owner !== null || roster.has(change.add)) return { error: "That player is already on the roster or unavailable." };
    roster.set(change.add, "BE");
    const active = [...roster.values()].filter((slot) => slot !== "IR").length;
    if (capacity > 0 && active > capacity) return { error: "Select a player to drop to make room." };
    // The league's pickup engine caps the roster at four primary centers.
    const centers = [...roster.keys()].filter((id) => players.get(id)?.primary_position === "C").length;
    if (player.primary_position === "C" && centers > 4) return { error: "This league allows up to four centers. Choose a center to drop." };
  }
  return { transactions };
}
