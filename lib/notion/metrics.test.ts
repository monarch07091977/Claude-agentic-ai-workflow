import { describe, it, expect, vi, beforeEach } from "vitest";
import { listMetricsForProcess, createMetric } from "./metrics";

const queryMock = vi.fn();
const createMock = vi.fn();

vi.mock("./client", () => ({
  getNotionClient: () => ({
    databases: { query: queryMock },
    pages: { create: createMock },
  }),
}));

vi.mock("./config", () => ({
  notionConfig: { valueMetricsDbId: "value-metrics-db-id" },
}));

function makeMetricPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "metric-1",
    properties: {
      "Metric Name": { title: [{ plain_text: "Requisition Cycle Time" }] },
      Process: { relation: [{ id: "process-1" }] },
      Category: { select: { name: "Cycle Time" } },
      Baseline: { number: 100 },
      Current: { number: 75 },
      Target: { number: 50 },
      Unit: { rich_text: [{ plain_text: "hrs" }] },
      ...overrides,
    },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  createMock.mockReset();
});

describe("listMetricsForProcess", () => {
  it("queries metrics filtered by process and maps results", async () => {
    queryMock.mockResolvedValue({ results: [makeMetricPage()] });
    const result = await listMetricsForProcess("process-1");
    expect(result).toEqual([
      {
        id: "metric-1",
        processId: "process-1",
        metricName: "Requisition Cycle Time",
        category: "Cycle Time",
        baseline: 100,
        current: 75,
        target: 50,
        unit: "hrs",
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith({
      database_id: "value-metrics-db-id",
      filter: { property: "Process", relation: { contains: "process-1" } },
    });
  });
});

describe("createMetric", () => {
  it("creates a metric page with all fields", async () => {
    createMock.mockResolvedValue(makeMetricPage());
    const result = await createMetric({
      processId: "process-1",
      metricName: "Requisition Cycle Time",
      category: "Cycle Time",
      baseline: 100,
      current: 75,
      target: 50,
      unit: "hrs",
    });
    expect(result.metricName).toBe("Requisition Cycle Time");
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "value-metrics-db-id" },
      properties: {
        "Metric Name": { title: [{ text: { content: "Requisition Cycle Time" } }] },
        Process: { relation: [{ id: "process-1" }] },
        Category: { select: { name: "Cycle Time" } },
        Baseline: { number: 100 },
        Current: { number: 75 },
        Target: { number: 50 },
        Unit: { rich_text: [{ text: { content: "hrs" } }] },
      },
    });
  });
});
