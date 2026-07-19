import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAgentsForProcess, createAgent } from "./agents";

const queryMock = vi.fn();
const createMock = vi.fn();

vi.mock("./client", () => ({
  getNotionClient: () => ({
    databases: { query: queryMock },
    pages: { create: createMock },
  }),
}));

vi.mock("./config", () => ({
  notionConfig: { agentBlueprintDbId: "agent-blueprint-db-id" },
}));

function makeAgentPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    properties: {
      "Agent Name": { title: [{ plain_text: "Intake Agent" }] },
      Process: { relation: [{ id: "process-1" }] },
      Role: { rich_text: [{ plain_text: "Validates incoming requisitions" }] },
      "Trigger Event": { rich_text: [{ plain_text: "New requisition submitted" }] },
      "Upstream Agent": { relation: [] },
      "HITL Exception Rule": { rich_text: [{ plain_text: "" }] },
      ...overrides,
    },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  createMock.mockReset();
});

describe("listAgentsForProcess", () => {
  it("queries agents filtered by process and maps results", async () => {
    queryMock.mockResolvedValue({ results: [makeAgentPage()] });
    const result = await listAgentsForProcess("process-1");
    expect(result).toEqual([
      {
        id: "agent-1",
        processId: "process-1",
        agentName: "Intake Agent",
        role: "Validates incoming requisitions",
        triggerEvent: "New requisition submitted",
        upstreamAgentId: "",
        hitlExceptionRule: "",
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith({
      database_id: "agent-blueprint-db-id",
      filter: { property: "Process", relation: { contains: "process-1" } },
    });
  });

  it("maps an agent with an upstream agent and an HITL rule", async () => {
    queryMock.mockResolvedValue({
      results: [
        makeAgentPage({
          "Upstream Agent": { relation: [{ id: "agent-0" }] },
          "HITL Exception Rule": {
            rich_text: [{ plain_text: "Escalate if confidence < 80%" }],
          },
        }),
      ],
    });
    const result = await listAgentsForProcess("process-1");
    expect(result[0].upstreamAgentId).toBe("agent-0");
    expect(result[0].hitlExceptionRule).toBe("Escalate if confidence < 80%");
  });
});

describe("createAgent", () => {
  it("creates an agent page without an Upstream Agent property when none is given", async () => {
    createMock.mockResolvedValue(makeAgentPage());
    const result = await createAgent({
      processId: "process-1",
      agentName: "Intake Agent",
      role: "Validates incoming requisitions",
      triggerEvent: "New requisition submitted",
      upstreamAgentId: "",
      hitlExceptionRule: "",
    });
    expect(result.agentName).toBe("Intake Agent");
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "agent-blueprint-db-id" },
      properties: {
        "Agent Name": { title: [{ text: { content: "Intake Agent" } }] },
        Process: { relation: [{ id: "process-1" }] },
        Role: { rich_text: [{ text: { content: "Validates incoming requisitions" } }] },
        "Trigger Event": { rich_text: [{ text: { content: "New requisition submitted" } }] },
        "HITL Exception Rule": { rich_text: [{ text: { content: "" } }] },
      },
    });
  });

  it("includes the Upstream Agent relation when one is given", async () => {
    createMock.mockResolvedValue(
      makeAgentPage({ "Upstream Agent": { relation: [{ id: "agent-0" }] } })
    );
    await createAgent({
      processId: "process-1",
      agentName: "Approval Agent",
      role: "Approves or escalates",
      triggerEvent: "Intake Agent completed",
      upstreamAgentId: "agent-0",
      hitlExceptionRule: "",
    });
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "agent-blueprint-db-id" },
      properties: {
        "Agent Name": { title: [{ text: { content: "Approval Agent" } }] },
        Process: { relation: [{ id: "process-1" }] },
        Role: { rich_text: [{ text: { content: "Approves or escalates" } }] },
        "Trigger Event": { rich_text: [{ text: { content: "Intake Agent completed" } }] },
        "HITL Exception Rule": { rich_text: [{ text: { content: "" } }] },
        "Upstream Agent": { relation: [{ id: "agent-0" }] },
      },
    });
  });
});
