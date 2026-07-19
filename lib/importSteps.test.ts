import { describe, it, expect } from "vitest";
import { parseStepRows } from "./importSteps";

describe("parseStepRows", () => {
  it("returns empty results for an empty sheet", () => {
    expect(parseStepRows([])).toEqual({ valid: [], skipped: [] });
  });

  it("skips everything with a clear reason when the Step Name column is missing", () => {
    const rows = [["Cost", "Cycle Time (hrs)"], [100, 4]];
    const result = parseStepRows(rows);
    expect(result.valid).toEqual([]);
    expect(result.skipped).toEqual([
      { row: 0, reason: "Missing required 'Step Name' column in header row" },
    ]);
  });

  it("parses a fully-populated row", () => {
    const rows = [
      ["Step Name", "Handoff Type", "Cycle Time (hrs)", "Cost", "Bottleneck", "Notes"],
      ["Submit requisition", "Human", 4, 100, "Yes", "Manual approval"],
    ];
    const result = parseStepRows(rows);
    expect(result.valid).toEqual([
      {
        stepName: "Submit requisition",
        handoffType: "Human",
        cycleTimeHours: 4,
        cost: 100,
        bottleneck: true,
        notes: "Manual approval",
      },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("skips a row with a blank Step Name and reports its row number", () => {
    const rows = [
      ["Step Name", "Cost"],
      ["", 50],
      ["Approve", 25],
    ];
    const result = parseStepRows(rows);
    expect(result.valid).toEqual([
      {
        stepName: "Approve",
        handoffType: "System",
        cycleTimeHours: 0,
        cost: 25,
        bottleneck: false,
        notes: "",
      },
    ]);
    expect(result.skipped).toEqual([{ row: 1, reason: "Missing Step Name" }]);
  });

  it("falls back to 'System' for an unrecognized Handoff Type", () => {
    const rows = [
      ["Step Name", "Handoff Type"],
      ["Review", "Robot"],
    ];
    const result = parseStepRows(rows);
    expect(result.valid[0].handoffType).toBe("System");
  });

  it("falls back to 0 for non-numeric Cycle Time and Cost", () => {
    const rows = [
      ["Step Name", "Cycle Time (hrs)", "Cost"],
      ["Review", "n/a", "unknown"],
    ];
    const result = parseStepRows(rows);
    expect(result.valid[0].cycleTimeHours).toBe(0);
    expect(result.valid[0].cost).toBe(0);
  });

  it("recognizes common truthy spellings for Bottleneck and treats everything else as false", () => {
    const rows = [
      ["Step Name", "Bottleneck"],
      ["A", "Yes"],
      ["B", "TRUE"],
      ["C", "1"],
      ["D", "No"],
      ["E", ""],
    ];
    const result = parseStepRows(rows);
    expect(result.valid.map((r) => r.bottleneck)).toEqual([true, true, true, false, false]);
  });

  it("matches headers case-insensitively and trims whitespace", () => {
    const rows = [
      [" step name ", " COST "],
      ["Review", 30],
    ];
    const result = parseStepRows(rows);
    expect(result.valid).toEqual([
      {
        stepName: "Review",
        handoffType: "System",
        cycleTimeHours: 0,
        cost: 30,
        bottleneck: false,
        notes: "",
      },
    ]);
  });

  it("applies defaults when optional columns are absent entirely", () => {
    const rows = [["Step Name"], ["Just a name"]];
    const result = parseStepRows(rows);
    expect(result.valid).toEqual([
      {
        stepName: "Just a name",
        handoffType: "System",
        cycleTimeHours: 0,
        cost: 0,
        bottleneck: false,
        notes: "",
      },
    ]);
  });
});
