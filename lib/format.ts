// fetch_league.py writes local wall-clock time with no zone ("2026-11-18T08:30").
// Format it as written, so a UTC server (Vercel) doesn't shift it.
export function formatSnapshotTime(iso: string): string {
  const d = new Date(iso.length === 16 ? `${iso}:00Z` : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
