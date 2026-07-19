import { buildAgentChain } from "@/lib/orchestration";
import type { AgentRecord } from "@/lib/notion/agents";

export function AgentFlowDiagram({ agents }: { agents: AgentRecord[] }) {
  const chain = buildAgentChain(agents);

  if (chain.length === 0) {
    return (
      <p className="mb-6 text-sm text-slate-500">
        Add an agent below to see the orchestration flow.
      </p>
    );
  }

  return (
    <div className="mb-6 flex items-start gap-2 overflow-x-auto pb-4">
      {chain.map((agent, index) => (
        <div key={agent.id} className="flex shrink-0 items-center gap-2">
          <div
            className={`w-48 shrink-0 rounded border p-3 text-sm ${
              agent.hitlExceptionRule
                ? "border-red-400 bg-red-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="font-medium">{agent.agentName}</p>
            <p className="text-xs text-slate-500">{agent.role}</p>
            <p className="mt-1 text-xs text-slate-400">Trigger: {agent.triggerEvent}</p>
            {agent.hitlExceptionRule && (
              <p className="mt-1 text-xs font-medium text-red-600">
                HITL: {agent.hitlExceptionRule}
              </p>
            )}
          </div>
          {index < chain.length - 1 && (
            <span className="shrink-0 text-xl text-slate-400">&rarr;</span>
          )}
        </div>
      ))}
    </div>
  );
}
