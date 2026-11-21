"use client";

import { useEffect, useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Confidence, Player } from "@/lib/types";
import { headshot, initials } from "@/lib/format";

/** Player headshot from ESPN's CDN, falling back to initials when ESPN has none. */
export function Photo({ p, size, w, h, round, dim, className }: {
  p: Pick<Player, "id" | "name">; size?: number; w?: number; h?: number; round?: boolean; dim?: boolean; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style: CSSProperties = { width: w ?? size, height: h ?? size };
  return (
    <span className={`photo${round ? " round" : ""}${dim ? " dim" : ""}${className ? ` ${className}` : ""}`} style={style}>
      {failed ? (
        <span className="initials">{initials(p.name)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- ESPN CDN, not worth an image-optimizer quota
        <img
          src={headshot(p.id)} alt="" loading="lazy" decoding="async"
          onError={() => setFailed(true)}
          // ESPN serves a tiny blank image for players without a headshot.
          onLoad={(e) => { if (e.currentTarget.naturalWidth < 40) setFailed(true); }}
        />
      )}
    </span>
  );
}

/** Where a figure comes from: ESPN (actual) or our projection. */
export function Source({ kind, children }: { kind: "espn" | "proj"; children?: ReactNode }) {
  return <span className={`src src-${kind}`}>{children ?? (kind === "espn" ? "ESPN" : "Projected")}</span>;
}

export function Tag({ tone, children }: { tone?: "warn" | "neg" | "pos" | "rec" | "rec-soft" | "ink" | "light" | "glass"; children: ReactNode }) {
  return <span className={`tag${tone ? ` tag-${tone}` : ""}`}>{children}</span>;
}

const LEVELS = { low: 1, medium: 2, high: 3 } as const;
export function Meter({ c, label = true }: { c: Confidence; label?: boolean }) {
  const n = LEVELS[c.level];
  const word = c.level[0].toUpperCase() + c.level.slice(1);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }} title={c.basis}>
      <span className="meter" aria-hidden>
        {[1, 2, 3].map((i) => <i key={i} className={i <= n ? "on" : undefined} />)}
      </span>
      {label && <span style={{ fontSize: 12, fontWeight: 600 }} aria-hidden>{word} confidence</span>}
      <span className="sr-only">{`${word} confidence (${c.basis})`}</span>
    </span>
  );
}

/** One game: a circle with basketball seams. Filled = a game, empty = none. */
export function GameIcon({ filled = true, color = "var(--ink)", size = 14, outline = false }: { filled?: boolean; color?: string; size?: number; outline?: boolean }) {
  const seam = outline ? "currentColor" : filled ? "#fff" : "var(--muted)";
  const so = outline ? 1 : filled ? 0.6 : 0.3;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {filled && !outline ? <circle cx="12" cy="12" r="11" fill={color} /> : <circle cx="12" cy="12" r="10.3" fill="none" stroke={seam} strokeOpacity={outline ? 1 : 0.5} strokeWidth="1.4" />}
      <g stroke={seam} strokeOpacity={so} strokeWidth="1.4" fill="none">
        <path d="M12 1.2v21.6M1.2 12h21.6" />
        <path d="M4.2 5c3.6 3.4 3.6 10.6 0 14M19.8 5c-3.6 3.4-3.6 10.6 0 14" />
      </g>
    </svg>
  );
}

export function Games({ n, of, color, size }: { n: number; of?: number; color?: string; size?: number }) {
  const total = Math.max(of ?? n, n);
  return (
    <span className="games" aria-label={`${n} game${n === 1 ? "" : "s"}`}>
      {Array.from({ length: total }, (_, i) => <GameIcon key={i} filled={i < n} color={color} size={size} />)}
    </span>
  );
}

export function Chevron({ dir }: { dir: "left" | "right" | "up-right" | "down" }) {
  const d = dir === "left" ? "M10 4 6 8l4 4" : dir === "right" ? "M6 4l4 4-4 4" : dir === "down" ? "M4 6l4 4 4-4" : "M5 11l6-6M6 5h5v5";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Steps through the days of the matchup week, finished ones included. */
export function DayStepper({ days, value, onChange, today, label, status }: {
  days: string[]; value: string; onChange: (d: string) => void; today: string; label: (d: string) => { day: string; date: string };
  status?: string;
}) {
  const i = days.indexOf(value);
  const l = label(value);
  return (
    <div className="stepper" role="group" aria-label="Day">
      <button className="icon-btn" onClick={() => onChange(days[i - 1])} disabled={i <= 0} aria-label="Previous day">
        <Chevron dir="left" />
      </button>
      <span className="stepper-label" aria-live="polite">
        <strong>{value === today ? "Today" : l.day}</strong>
        <span>{l.date}</span>
        {status && <Source kind={status === "Final" ? "espn" : "proj"}>{status}</Source>}
      </span>
      <button className="icon-btn" onClick={() => onChange(days[i + 1])} disabled={i >= days.length - 1} aria-label="Next day">
        <Chevron dir="right" />
      </button>
    </div>
  );
}

export function InfoPopup({ label, trigger, children }: { label: string; trigger: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <>
      <button type="button" className="popup-trigger" popoverTarget={id} aria-label={label}>{trigger}</button>
      <div id={id} popover="auto" className="info-popup">{children}</div>
    </>
  );
}

export function Card({ title, sub, aside, children, className }: { title?: ReactNode; sub?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card${className ? ` ${className}` : ""}`}>
      {(title || aside) && (
        <div className="card-head">
          <div className="grow">
            {title && <h2>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted" style={{ padding: "12px 0" }}>{children}</p>;
}

/** Sets the tab title per page: "Today · Fantasy Picks". */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Fantasy Picks`;
  }, [title]);
}

/**
 * The chosen day, kept in ?day= so a day can be linked and survives a reload.
 * Without one it's `start` (today) when that's among the days, else the first day.
 */
export function useDay(days: string[], start?: string): [string | undefined, (d: string) => void] {
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    // Read once on mount; the URL is the source of truth after a reload or a shared link.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked(new URLSearchParams(window.location.search).get("day"));
  }, []);
  const home = start && days.includes(start) ? start : days[0];
  const date = picked && days.includes(picked) ? picked : home;
  const set = (d: string) => {
    setPicked(d);
    const url = new URL(window.location.href);
    if (d === home) url.searchParams.delete("day");
    else url.searchParams.set("day", d);
    window.history.replaceState(null, "", url);
  };
  return [date, set];
}

/** A small piece of page state kept in the URL (?key=value), so it survives a reload or a shared link. */
export function useQueryState<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (v: T) => void] {
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked(new URLSearchParams(window.location.search).get(key));
  }, [key]);
  const value = (picked && (allowed as readonly string[]).includes(picked) ? picked : fallback) as T;
  const set = (v: T) => {
    setPicked(v);
    const url = new URL(window.location.href);
    if (v === fallback) url.searchParams.delete(key);
    else url.searchParams.set(key, v);
    window.history.replaceState(null, "", url);
  };
  return [value, set];
}
