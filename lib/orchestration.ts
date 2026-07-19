import type { AgentRecord } from "./notion/agents";

export function buildAgentChain(agents: AgentRecord[]): AgentRecord[] {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const childByUpstream = new Map<string, AgentRecord>();
  for (const agent of agents) {
    if (agent.upstreamAgentId && byId.has(agent.upstreamAgentId)) {
      childByUpstream.set(agent.upstreamAgentId, agent);
    }
  }

  const roots = agents.filter(
    (agent) => !agent.upstreamAgentId || !byId.has(agent.upstreamAgentId)
  );

  const ordered: AgentRecord[] = [];
  const visited = new Set<string>();

  for (const root of roots) {
    let current: AgentRecord | undefined = root;
    while (current && !visited.has(current.id)) {
      ordered.push(current);
      visited.add(current.id);
      current = childByUpstream.get(current.id);
    }
  }

  for (const agent of agents) {
    if (!visited.has(agent.id)) {
      ordered.push(agent);
    }
  }

  return ordered;
}
