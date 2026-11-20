"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/data";
import { ago, timestamp } from "@/lib/format";
import type { Data } from "@/lib/types";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/matchup", label: "Matchup" },
  { href: "/free-agents", label: "Free agents" },
  { href: "/opponent", label: "Opponent" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ctx = useData();

  return (
    <>
      <header className="header">
        <div className="brand">
          <strong>Fantasy Basketball Picks</strong>
          <span className="muted"> · start/sit and pickups for one ESPN league</span>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        {ctx.status === "ready" && <ModeBar />}
      </header>
      <main className="main">
        {ctx.status === "loading" && <p className="muted">Loading league data…</p>}
        {ctx.status === "error" && (
          <p className="banner banner-error">Couldn’t load the league data ({ctx.error}).</p>
        )}
        {ctx.status === "ready" && ctx.data && children}
      </main>
    </>
  );
}

function ModeBar() {
  const { live, featured, mode, setMode, replayIndex, setReplayIndex, data, liveIsStale } = useData();
  const entry = featured[replayIndex];
  const shown = data as Data;

  return (
    <div className="modebar">
      {liveIsStale && live && (
        <p className="banner banner-warn">
          Live data is more than a day old (last pulled {ago(live.meta.updated_at)}), so the ESPN connection may need
          reconnecting.
          {featured.length > 0 && mode === "replay" && " Showing a saved snapshot instead."}
        </p>
      )}

      <div className="modebar-row">
        <div className="toggle" role="group" aria-label="Data source">
          <button aria-pressed={mode === "live"} onClick={() => setMode("live")}>
            Live
          </button>
          <button
            aria-pressed={mode === "replay"}
            onClick={() => setMode("replay")}
            disabled={featured.length === 0}
            title={featured.length === 0 ? "No snapshots curated yet" : undefined}
          >
            Replay
          </button>
        </div>
        <span className="updated">
          Last updated <strong>{timestamp(shown.meta.updated_at)}</strong>
          <span className="muted"> ({ago(shown.meta.updated_at)})</span>
        </span>
      </div>

      {mode === "replay" && entry && (
        <div className="replay">
          <button onClick={() => setReplayIndex(replayIndex - 1)} disabled={replayIndex === 0} aria-label="Previous">
            ←
          </button>
          <div>
            <div>
              <span className="muted">
                Snapshot {replayIndex + 1} of {featured.length}:
              </span>{" "}
              <strong>{entry.title}</strong>
            </div>
            {entry.description && <div className="muted">{entry.description}</div>}
          </div>
          <button
            onClick={() => setReplayIndex(replayIndex + 1)}
            disabled={replayIndex >= featured.length - 1}
            aria-label="Next"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
