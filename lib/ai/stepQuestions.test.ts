import { describe, it, expect } from "vitest";
import { buildStepQuestionsPrompt } from "./stepQuestions";
import type { StepRecord } from "../notion/steps";

function makeStep(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    id: "step-1",
    processId: "process-1",
    stepName: "Approve requisition",
    sequence: 1,
    handoffType: "Human",
    cycleTimeHours: 2,
    cost: 40,
    bottleneck: false,
    notes: "",
    ...overrides,
  };
}

describe("buildStepQuestionsPrompt", () => {
  it("includes the step's name, handoff type, cycle time, cost, and bottleneck flag", () => {
    const prompt = buildStepQuestionsPrompt(makeStep());
    expect(prompt).toContain("Approve requisition");
    expect(prompt).toContain("Human");
    expect(prompt).toContain("2 hours");
    expect(prompt).toContain("$40");
    expect(prompt).toContain("Known bottleneck: no");
  });

  it("includes notes when present and omits the Notes line when blank", () => {
    const withNotes = buildStepQuestionsPrompt(makeStep({ notes: "Depends on vendor tier" }));
    expect(withNotes).toContain("Notes: Depends on vendor tier");

    const withoutNotes = buildStepQuestionsPrompt(makeStep({ notes: "" }));
    expect(withoutNotes).not.toContain("Notes:");
  });

  it("asks for exactly six questions across the three dimensions", () => {
    const prompt = buildStepQuestionsPrompt(makeStep());
    expect(prompt).toContain("six questions");
    expect(prompt).toContain("dataComplexity");
    expect(prompt).toContain("decisionLogic");
    expect(prompt).toContain("contextVolatility");
  });
});
