"use client";

import { FreeAgentDetail } from "@/components/FreeAgentDetail";
import { useData } from "@/lib/data";

export default function ExamplePage() {
  const { data } = useData();
  const pickup = data?.recommendations.pickups[0];
  return pickup ? <FreeAgentDetail id={pickup.add_player_id} /> : null;
}
