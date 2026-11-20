import { WarRoom } from "@/components/WarRoom";
import { MOCK_RECOMMENDATIONS } from "@/lib/mock-recommendations";
import { buildRun } from "@/lib/recommendations";
import { loadWorld, readRawSnapshot } from "@/lib/snapshot";

export default function Page() {
  const world = loadWorld();
  const previous = readRawSnapshot("previous.json");
  // The hand-written sample only matches the mock snapshot, so it's never shown against real data.
  const sample = world.league.isMock
    ? (({ warnings: _w, ...run }) => (void _w, run))(
        buildRun(MOCK_RECOMMENDATIONS, world, "mock", world.league.snapshotAt),
      )
    : null;

  return <WarRoom world={world} sample={sample} previousAt={previous?.generated_at ?? null} />;
}
