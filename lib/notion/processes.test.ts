import { describe, it, expect, vi, beforeEach } from "vitest";
import { listProcesses, createProcess } from "./processes";

const queryMock = vi.fn();
const createMock = vi.fn();

vi.mock("./client", () => ({
  getNotionClient: () => ({
    databases: { query: queryMock },
    pages: { create: createMock },
  }),
}));

vi.mock("./config", () => ({
  notionConfig: { processesDbId: "test-db-id" },
}));

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "page-1",
    properties: {
      Name: { title: [{ plain_text: "Requisition to Pay" }] },
      Description: { rich_text: [{ plain_text: "P2P process" }] },
      Owner: { rich_text: [{ plain_text: "Jane Doe" }] },
      Status: { select: { name: "In Progress" } },
      "Current Phase": { select: { name: "2" } },
      "Total Cycle Time (hrs)": { rollup: { type: "number", number: 12.5 } },
      ...overrides,
    },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  createMock.mockReset();
});

describe("listProcesses", () => {
  it("maps Notion pages to ProcessRecord objects", async () => {
    queryMock.mockResolvedValue({ results: [makePage()] });
    const result = await listProcesses();
    expect(result).toEqual([
      {
        id: "page-1",
        name: "Requisition to Pay",
        description: "P2P process",
        owner: "Jane Doe",
        status: "In Progress",
        currentPhase: "2",
        totalCycleTimeHours: 12.5,
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith({ database_id: "test-db-id" });
  });
});

describe("createProcess", () => {
  it("creates a page with default status and phase", async () => {
    createMock.mockResolvedValue(
      makePage({
        Status: { select: { name: "Not Started" } },
        "Current Phase": { select: { name: "1" } },
        "Total Cycle Time (hrs)": { rollup: { type: "number", number: 0 } },
      })
    );
    const result = await createProcess({
      name: "Requisition to Pay",
      description: "P2P process",
      owner: "Jane Doe",
    });
    expect(result.status).toBe("Not Started");
    expect(result.totalCycleTimeHours).toBe(0);
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "test-db-id" },
      properties: {
        Name: { title: [{ text: { content: "Requisition to Pay" } }] },
        Description: { rich_text: [{ text: { content: "P2P process" } }] },
        Owner: { rich_text: [{ text: { content: "Jane Doe" } }] },
        Status: { select: { name: "Not Started" } },
        "Current Phase": { select: { name: "1" } },
      },
    });
  });
});
