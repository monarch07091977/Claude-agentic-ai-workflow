import { describe, it, expect } from "vitest";
import { buildScoreFromAnswersPrompt } from "./scoreFromAnswers";
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

describe("buildScoreFromAnswersPrompt", () => {
  it("includes the step's fields and every question/answer pair", () => {
    const prompt = buildScoreFromAnswersPrompt(makeStep(), [
      {
        dimension: "dataComplexity",
        question: "How many systems does this step pull data from?",
        answer: "Three: the ERP, a spreadsheet, and email.",
      },
      {
        dimension: "decisionLogic",
        question: "Is there a fixed approval threshold?",
        answer: "Yes, anything under $500 auto-approves.",
      },
    ]);
    expect(prompt).toContain("Approve requisition");
    expect(prompt).toContain(
      "Q (dataComplexity): How many systems does this step pull data from?"
    );
    expect(prompt).toContain("A: Three: the ERP, a spreadsheet, and email.");
    expect(prompt).toContain("Q (decisionLogic): Is there a fixed approval threshold?");
    expect(prompt).toContain("A: Yes, anything under $500 auto-approves.");
  });
});
