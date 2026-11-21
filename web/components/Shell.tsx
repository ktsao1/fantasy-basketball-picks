"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/data";
import { ago, clock } from "@/lib/format";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/matchup", label: "Matchup" },
  { href: "/free-agents", label: "Free agents" },
  { href: "/track-record", label: "Track record" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ctx = useData();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
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
      <main className="page" id="main" tabIndex={-1}>
        {ctx.status === "loading" && <p className="loading">Loading league data…</p>}
        {ctx.status === "error" && (
          <div className="error" role="alert">
            <p><b>Couldn&rsquo;t load the league data.</b></p>
            <p>Check your connection, then try again. If it keeps failing, the latest pull may be missing from the site.</p>
            <button className="btn" onClick={ctx.reload}>Try again</button>
            <small>{ctx.error}</small>
          </div>
        )}
        {ctx.status === "ready" && ctx.data && children}
      </main>
    </>
  );
}

function TopRight() {
  const { data } = useData();
  const here = usePathname();
  if (!data) return null;
  const at = data.meta.updated_at;
  return (
    <div className="topbar-right">
      <Link href="/how-it-works" className="how" aria-current={here === "/how-it-works" ? "page" : undefined}>How it works</Link>
      <span className="synced" title={new Date(at).toLocaleString()} data-time={clock(at)}>
        <img src="/img/espn.png" alt="ESPN" width={16} height={16} />
        Last synced {clock(at)}
      </span>
    </div>
  );
}

function Notices() {
  const { data, isStale } = useData();
  if (!isStale || !data) return null;
  return (
    <div className="notice-warn">
      <p className="notice">
        This data is more than a day old (last pulled {ago(data.meta.updated_at)}), so the ESPN connection may need
        reconnecting.
      </p>
    </div>
  );
}
