import { describe, it, expect, vi, beforeEach } from "vitest";
import { listStepsForProcess, createStep, updateStep, deleteStep } from "./steps";

const queryMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock("./client", () => ({
  getNotionClient: () => ({
    databases: { query: queryMock },
    pages: { create: createMock, update: updateMock },
  }),
}));

vi.mock("./config", () => ({
  notionConfig: { stepsDbId: "steps-db-id" },
}));

function makeStepPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "step-1",
    properties: {
      "Step Name": { title: [{ plain_text: "Submit Requisition" }] },
      Process: { relation: [{ id: "process-1" }] },
      Sequence: { number: 1 },
      "Handoff Type": { select: { name: "Human" } },
      "Cycle Time (hrs)": { number: 4 },
      Cost: { number: 100 },
      Bottleneck: { checkbox: true },
      Notes: { rich_text: [{ plain_text: "Manual approval" }] },
      ...overrides,
    },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
});

describe("listStepsForProcess", () => {
  it("queries steps filtered by process and sorted by sequence", async () => {
    queryMock.mockResolvedValue({ results: [makeStepPage()] });
    const result = await listStepsForProcess("process-1");
    expect(result).toEqual([
      {
        id: "step-1",
        processId: "process-1",
        stepName: "Submit Requisition",
        sequence: 1,
        handoffType: "Human",
        cycleTimeHours: 4,
        cost: 100,
        bottleneck: true,
        notes: "Manual approval",
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith({
      database_id: "steps-db-id",
      filter: { property: "Process", relation: { contains: "process-1" } },
      sorts: [{ property: "Sequence", direction: "ascending" }],
    });
  });
});

describe("createStep", () => {
  it("creates a step page with the given properties", async () => {
    createMock.mockResolvedValue(makeStepPage());
    const result = await createStep({
      processId: "process-1",
      stepName: "Submit Requisition",
      sequence: 1,
      handoffType: "Human",
      cycleTimeHours: 4,
      cost: 100,
      bottleneck: true,
      notes: "Manual approval",
    });
    expect(result.stepName).toBe("Submit Requisition");
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "steps-db-id" },
      properties: {
        "Step Name": { title: [{ text: { content: "Submit Requisition" } }] },
        Process: { relation: [{ id: "process-1" }] },
        Sequence: { number: 1 },
        "Handoff Type": { select: { name: "Human" } },
        "Cycle Time (hrs)": { number: 4 },
        Cost: { number: 100 },
        Bottleneck: { checkbox: true },
        Notes: { rich_text: [{ text: { content: "Manual approval" } }] },
      },
    });
  });
});

describe("updateStep", () => {
  it("only sends properties that were provided", async () => {
    updateMock.mockResolvedValue(makeStepPage({ Bottleneck: { checkbox: false } }));
    await updateStep("step-1", { bottleneck: false });
    expect(updateMock).toHaveBeenCalledWith({
      page_id: "step-1",
      properties: { Bottleneck: { checkbox: false } },
    });
  });
});

describe("deleteStep", () => {
  it("archives the page", async () => {
    updateMock.mockResolvedValue(makeStepPage());
    await deleteStep("step-1");
    expect(updateMock).toHaveBeenCalledWith({ page_id: "step-1", archived: true });
  });
});
