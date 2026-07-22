import { describe, it, expect } from "vitest";
import { buildDraftStepsPrompt, STEP_ROW_HEADER } from "./draftSteps";
import { parseStepRows } from "../importSteps";

describe("buildDraftStepsPrompt", () => {
  it("includes the raw process text and the required row shape", () => {
    const prompt = buildDraftStepsPrompt("First the requester submits a form...");
    expect(prompt).toContain("First the requester submits a form...");
    expect(prompt).toContain("Step Name");
    expect(prompt).toContain("Handoff Type");
  });
});

describe("STEP_ROW_HEADER", () => {
  it("matches the column names parseStepRows recognizes, so a drafted row parses correctly", () => {
    const rows = [
      STEP_ROW_HEADER,
      ["Submit form", "Human", "1", "10", "No", "Some notes"],
    ];
    const { valid, skipped } = parseStepRows(rows);
    expect(skipped).toEqual([]);
    expect(valid).toEqual([
      {
        stepName: "Submit form",
        handoffType: "Human",
        cycleTimeHours: 1,
        cost: 10,
        bottleneck: false,
        notes: "Some notes",
      },
    ]);
  });
});
