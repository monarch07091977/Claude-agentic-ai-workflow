import { describe, it, expect } from "vitest";
import { buildSuggestScorePrompt } from "./suggestScore";
import type { StepRecord } from "../notion/steps";

function makeStep(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    id: "step-1",
    processId: "process-1",
    stepName: "Match PO to invoice line items",
    sequence: 1,
    handoffType: "Human",
    cycleTimeHours: 2,
    cost: 40,
    bottleneck: true,
    notes: "",
    ...overrides,
  };
}

describe("buildSuggestScorePrompt", () => {
  it("includes the step's name, handoff type, cycle time, cost, and bottleneck flag", () => {
    const prompt = buildSuggestScorePrompt(makeStep());
    expect(prompt).toContain("Match PO to invoice line items");
    expect(prompt).toContain("Human");
    expect(prompt).toContain("2 hours");
    expect(prompt).toContain("$40");
    expect(prompt).toContain("Known bottleneck: yes");
  });

  it("includes notes when present and omits the Notes line when blank", () => {
    const withNotes = buildSuggestScorePrompt(makeStep({ notes: "Requires manual review" }));
    expect(withNotes).toContain("Notes: Requires manual review");

    const withoutNotes = buildSuggestScorePrompt(makeStep({ notes: "" }));
    expect(withoutNotes).not.toContain("Notes:");
  });
});
