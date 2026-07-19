import { describe, it, expect } from "vitest";
import { buildAgentChain } from "./orchestration";
import type { AgentRecord } from "./notion/agents";

function makeAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: "a1",
    processId: "p1",
    agentName: "Agent",
    role: "",
    triggerEvent: "",
    upstreamAgentId: "",
    hitlExceptionRule: "",
    ...overrides,
  };
}

describe("buildAgentChain", () => {
  it("returns an empty array for no agents", () => {
    expect(buildAgentChain([])).toEqual([]);
  });

  it("orders a simple linear chain from root to leaf, regardless of input order", () => {
    const a = makeAgent({ id: "a", agentName: "A", upstreamAgentId: "" });
    const b = makeAgent({ id: "b", agentName: "B", upstreamAgentId: "a" });
    const c = makeAgent({ id: "c", agentName: "C", upstreamAgentId: "b" });
    const result = buildAgentChain([c, a, b]);
    expect(result.map((agent) => agent.id)).toEqual(["a", "b", "c"]);
  });

  it("concatenates multiple independent root chains", () => {
    const a = makeAgent({ id: "a", upstreamAgentId: "" });
    const b = makeAgent({ id: "b", upstreamAgentId: "a" });
    const x = makeAgent({ id: "x", upstreamAgentId: "" });
    const result = buildAgentChain([a, b, x]);
    expect(result.map((agent) => agent.id)).toEqual(["a", "b", "x"]);
  });

  it("treats an upstreamAgentId pointing outside the list as a root", () => {
    const a = makeAgent({ id: "a", upstreamAgentId: "missing" });
    const result = buildAgentChain([a]);
    expect(result.map((agent) => agent.id)).toEqual(["a"]);
  });

  it("does not infinite-loop on a cycle and still includes every agent exactly once", () => {
    const a = makeAgent({ id: "a", upstreamAgentId: "b" });
    const b = makeAgent({ id: "b", upstreamAgentId: "a" });
    const result = buildAgentChain([a, b]);
    expect(result.map((agent) => agent.id)).toEqual(["a", "b"]);
  });
});
