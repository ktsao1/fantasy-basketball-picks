import { FreeAgentDetail } from "@/components/FreeAgentDetail";

export default async function FreeAgentPage({ params }: PageProps<"/free-agents/[id]">) {
  const { id } = await params;
  return <FreeAgentDetail id={Number(id)} />;
}
