import { describe, it, expect, vi, beforeEach } from "vitest";
import { listSuitabilityScoresForSteps, upsertSuitabilityScore } from "./suitability";

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
  notionConfig: { suitabilityDbId: "suitability-db-id" },
}));

function makeScorePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "score-1",
    properties: {
      Score: { title: [{ plain_text: "Score" }] },
      Step: { relation: [{ id: "step-1" }] },
      "Data Complexity": { number: 2 },
      "Decision Logic": { number: 4 },
      "Context Volatility": { number: 2 },
      "Suitability Score": { number: 3 },
      Classification: { select: { name: "Agentic" } },
      ...overrides,
    },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
});

describe("listSuitabilityScoresForSteps", () => {
  it("returns an empty array without querying Notion when given no step ids", async () => {
    const result = await listSuitabilityScoresForSteps([]);
    expect(result).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("queries with an OR filter across all step ids and maps results", async () => {
    queryMock.mockResolvedValue({ results: [makeScorePage()] });
    const result = await listSuitabilityScoresForSteps(["step-1", "step-2"]);
    expect(result).toEqual([
      {
        id: "score-1",
        stepId: "step-1",
        dataComplexity: 2,
        decisionLogic: 4,
        contextVolatility: 2,
        suitabilityScore: 3,
        classification: "Agentic",
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith({
      database_id: "suitability-db-id",
      filter: {
        or: [
          { property: "Step", relation: { contains: "step-1" } },
          { property: "Step", relation: { contains: "step-2" } },
        ],
      },
    });
  });
});

describe("upsertSuitabilityScore", () => {
  it("creates a new score page when none exists for the step", async () => {
    queryMock.mockResolvedValue({ results: [] });
    createMock.mockResolvedValue(makeScorePage());
    const result = await upsertSuitabilityScore({
      stepId: "step-1",
      dataComplexity: 2,
      decisionLogic: 4,
      contextVolatility: 2,
    });
    expect(result.suitabilityScore).toBe(3);
    expect(result.classification).toBe("Agentic");
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "suitability-db-id" },
      properties: {
        Score: { title: [{ text: { content: "Score" } }] },
        Step: { relation: [{ id: "step-1" }] },
        "Data Complexity": { number: 2 },
        "Decision Logic": { number: 4 },
        "Context Volatility": { number: 2 },
        "Suitability Score": { number: 3 },
        Classification: { select: { name: "Agentic" } },
      },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates the existing score page when one already exists for the step", async () => {
    queryMock.mockResolvedValue({ results: [makeScorePage()] });
    updateMock.mockResolvedValue(
      makeScorePage({
        "Data Complexity": { number: 5 },
        "Suitability Score": { number: 3.75 },
        Classification: { select: { name: "Human-required" } },
      })
    );
    const result = await upsertSuitabilityScore({
      stepId: "step-1",
      dataComplexity: 5,
      decisionLogic: 4,
      contextVolatility: 2,
    });
    expect(result.dataComplexity).toBe(5);
    expect(updateMock).toHaveBeenCalledWith({
      page_id: "score-1",
      properties: {
        "Data Complexity": { number: 5 },
        "Decision Logic": { number: 4 },
        "Context Volatility": { number: 2 },
        "Suitability Score": { number: 3.75 },
        Classification: { select: { name: "Human-required" } },
      },
    });
    expect(createMock).not.toHaveBeenCalled();
  });
});
