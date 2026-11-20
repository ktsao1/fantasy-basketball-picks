import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { loadWorld } from "@/lib/snapshot";
import { formatSnapshotTime } from "@/lib/format";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "War Room",
  description: "Who do I start, and who do I pick up?",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { league } = loadWorld();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3 sm:px-6">
            <span className="text-sm font-semibold tracking-[0.14em] text-ink">WAR ROOM</span>
            <span className="text-sm text-ink-2">
              {league.name} · {league.myTeam.name} ({league.myTeam.record}) · Week {league.matchupPeriod}
            </span>
            <div className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-1 whitespace-nowrap font-mono text-xs text-ink-2">
              <span title={league.scoringRaw} className="rounded border border-line px-1.5 py-0.5 uppercase">
                {league.scoring}
              </span>
              <span>Snapshot {formatSnapshotTime(league.snapshotAt)}</span>
              {league.isMock && <span className="text-down uppercase">Mock data</span>}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
