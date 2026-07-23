import { describe, it, expect } from "vitest";
import { selectAgenticSteps, buildDraftAgentsPrompt } from "./draftAgents";
import type { StepRecord } from "../notion/steps";
import type { SuitabilityScoreRecord } from "../notion/suitability";

function makeStep(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    id: "step-1",
    processId: "process-1",
    stepName: "Match PO to invoice",
    sequence: 1,
    handoffType: "Human",
    cycleTimeHours: 2,
    cost: 40,
    bottleneck: false,
    notes: "",
    ...overrides,
  };
}

function makeScore(overrides: Partial<SuitabilityScoreRecord> = {}): SuitabilityScoreRecord {
  return {
    id: "score-1",
    stepId: "step-1",
    dataComplexity: 4,
    decisionLogic: 4,
    contextVolatility: 2,
    suitabilityScore: 3.5,
    classification: "Agentic",
    assessmentQA: "",
    ...overrides,
  };
}

describe("selectAgenticSteps", () => {
  it("keeps only steps whose score is classified Agentic", () => {
    const steps = [
      makeStep({ id: "step-1", stepName: "Agentic step" }),
      makeStep({ id: "step-2", stepName: "Algorithmic step" }),
      makeStep({ id: "step-3", stepName: "No score yet" }),
    ];
    const scores = [
      makeScore({ stepId: "step-1", classification: "Agentic" }),
      makeScore({ stepId: "step-2", classification: "Algorithmic" }),
    ];
    const result = selectAgenticSteps(steps, scores);
    expect(result).toEqual([{ stepName: "Agentic step", handoffType: "Human" }]);
  });
});

describe("buildDraftAgentsPrompt", () => {
  it("lists each agentic step by name and handoff type", () => {
    const prompt = buildDraftAgentsPrompt([
      { stepName: "Match PO to invoice", handoffType: "Human" },
    ]);
    expect(prompt).toContain("Match PO to invoice");
    expect(prompt).toContain("Human");
  });
});
