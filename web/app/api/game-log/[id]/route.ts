import type { PlayerGame } from "@/lib/types";

type LoggedEvent = { eventId: string; stats?: string[] };
type EspnGameLog = {
  labels?: string[];
  events?: Record<string, {
    gameDate: string;
    gameResult?: string;
    atVs?: string;
    opponent?: { abbreviation?: string; displayName?: string };
  }>;
  seasonTypes?: { displayName: string; categories: { events?: LoggedEvent[] }[] }[];
};

const easternDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

function parseStats(labels: string[], values: string[]): Record<string, number> {
  const stats: Record<string, number> = {};
  labels.forEach((label, i) => {
    const value = values[i]?.trim();
    if (!value) return;
    if (label === "FG" || label === "FT" || label === "3PT") {
      const match = value.match(/^(\d+)-(\d+)$/);
      if (!match) return;
      const prefix = label === "3PT" ? "3P" : label;
      stats[`${prefix}M`] = Number(match[1]);
      stats[`${prefix}A`] = Number(match[2]);
    } else if (/^\d+(\.\d+)?$/.test(value)) {
      stats[label] = Number(value);
    }
  });
  return stats;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const season = new URL(request.url).searchParams.get("season") ?? "";
  if (!/^\d{1,10}$/.test(id) || !/^20\d{2}$/.test(season)) {
    return Response.json({ error: "Invalid player or season" }, { status: 400 });
  }
  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/gamelog?season=${season}`,
      { next: { revalidate: 900 }, signal: AbortSignal.timeout(6000) },
    );
    if (!response.ok) throw new Error("ESPN game log unavailable");
    const log: EspnGameLog = await response.json();
    const games = new Map<string, PlayerGame & { start: string }>();
    for (const seasonType of log.seasonTypes ?? []) {
      if (!/regular season|postseason|playoffs/i.test(seasonType.displayName)) continue;
      for (const category of seasonType.categories) {
        for (const { eventId, stats } of category.events ?? []) {
          const event = log.events?.[eventId];
          if (!stats?.length || !event || !["W", "L"].includes(event.gameResult ?? "")) continue;
          const start = new Date(event.gameDate);
          if (Number.isNaN(start.getTime())) continue;
          const box = parseStats(log.labels ?? [], stats);
          if (box.MIN == null) continue;
          games.set(eventId, {
            id: eventId, date: easternDate.format(start), start: start.toISOString(),
            opponent: event.opponent?.abbreviation ?? null, opponentName: event.opponent?.displayName ?? null,
            home: event.atVs === "vs", stats: box,
          });
        }
      }
    }
    return Response.json([...games.values()].sort((a, b) => b.start.localeCompare(a.start))
      .slice(0, 10).map(({ id, date, opponent, opponentName, home, stats }) => ({ id, date, opponent, opponentName, home, stats })));
  } catch {
    return Response.json({ error: "ESPN game log unavailable" }, { status: 502 });
  }
}
