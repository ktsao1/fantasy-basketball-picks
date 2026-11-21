"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/data";
import { ago, clock, dayShort } from "@/lib/format";
import { Chevron } from "./ui";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/matchup", label: "Matchup" },
  { href: "/free-agents", label: "Free agents" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ctx = useData();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">Fantasy Picks</Link>
          <nav className="nav" aria-label="Pages">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          {ctx.status === "ready" && <TopRight />}
        </div>
      </header>
      {ctx.status === "ready" && <Notices />}
      <main className="page">
        {ctx.status === "loading" && <p className="loading">Loading league data…</p>}
        {ctx.status === "error" && <p className="error">Couldn&rsquo;t load the league data ({ctx.error}).</p>}
        {ctx.status === "ready" && ctx.data && children}
      </main>
    </>
  );
}

function TopRight() {
  const { featured, mode, setMode, data, liveIsStale } = useData();
  if (!data) return null;
  const at = data.meta.updated_at;
  return (
    <div className="topbar-right">
      <span className={`synced${liveIsStale && mode === "live" ? " stale" : ""}`} title={new Date(at).toLocaleString()}>
        <span>{mode === "replay" ? "Snapshot from" : "Last synced"}</span> {mode === "replay" ? dayShort(at.slice(0, 10)) : ""} {clock(at)}
      </span>
      <div className="mode" role="group" aria-label="Data source">
        <button aria-pressed={mode === "live"} onClick={() => setMode("live")}>Live</button>
        <button
          aria-pressed={mode === "replay"}
          onClick={() => setMode("replay")}
          disabled={featured.length === 0}
          title={featured.length === 0 ? "No snapshots curated yet" : "Step through saved snapshots"}
        >
          Replay
        </button>
      </div>
    </div>
  );
}

function Notices() {
  const { live, featured, mode, replayIndex, setReplayIndex, liveIsStale } = useData();
  const entry = featured[replayIndex];
  return (
    <>
      {liveIsStale && live && (
        <div className="notice-warn">
          <p className="notice">
            Live data is more than a day old (last pulled {ago(live.meta.updated_at)}), so the ESPN connection may need
            reconnecting.{featured.length > 0 && mode === "replay" && " Showing a saved snapshot instead."}
          </p>
        </div>
      )}
      {mode === "replay" && entry && (
        <div className="notice-replay">
          <div className="notice">
            <button className="icon-btn" onClick={() => setReplayIndex(replayIndex - 1)} disabled={replayIndex === 0} aria-label="Previous snapshot">
              <Chevron dir="left" />
            </button>
            <p className="grow">
              <strong>Replay {replayIndex + 1} of {featured.length}: {entry.title}.</strong> {entry.description}
            </p>
            <button className="icon-btn" onClick={() => setReplayIndex(replayIndex + 1)} disabled={replayIndex >= featured.length - 1} aria-label="Next snapshot">
              <Chevron dir="right" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
