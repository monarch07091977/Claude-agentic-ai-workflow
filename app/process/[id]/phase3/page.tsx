import { PhaseTabs } from "@/components/PhaseTabs";
import { AgentFlowDiagram } from "@/components/AgentFlowDiagram";
import { AgentForm } from "@/components/AgentForm";
import { listAgentsForProcess, type AgentRecord } from "@/lib/notion/agents";

export const revalidate = 10;

export default async function Phase3Page({ params }: { params: { id: string } }) {
  let agents: AgentRecord[] = [];
  let error: string | null = null;
  try {
    agents = await listAgentsForProcess(params.id);
  } catch {
    error = "Failed to load agent blueprint. Please try again.";
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <PhaseTabs processId={params.id} activePhase={3} />
      <h2 className="mb-4 text-lg font-semibold">
        Reimagined Process and Agentic Orchestration Design
      </h2>
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </p>
      ) : (
        <>
          <AgentFlowDiagram agents={agents} />
          <AgentForm processId={params.id} agents={agents} />
        </>
      )}
    </main>
  );
}
