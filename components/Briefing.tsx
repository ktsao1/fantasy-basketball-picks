import { formatSnapshotTime } from "@/lib/format";

export function Briefing({ lines, previousAt }: { lines: string[]; previousAt: string | null }) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <p className="border-b border-line px-5 py-3 text-xs text-ink-3">
        {previousAt
          ? `Compared with the snapshot from ${formatSnapshotTime(previousAt)}`
          : "No previous snapshot, so this covers the week ahead only"}
      </p>
      {lines.length ? (
        <ol className="divide-y divide-line">
          {lines.map((l, i) => (
            <li key={i} className="grid grid-cols-[1.75rem_1fr] px-5 py-4">
              <span className="pt-px font-mono text-sm text-ink-3">{i + 1}</span>
              <span className="text-[15px] leading-relaxed text-ink">{l}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-6 text-sm text-ink-3">Nothing new this week.</p>
      )}
    </section>
  );
}
