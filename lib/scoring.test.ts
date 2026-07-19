import { describe, it, expect } from "vitest";
import { computeBaselineSummary } from "./scoring";
import type { StepRecord } from "./notion/steps";

function makeStep(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    id: "s1",
    processId: "p1",
    stepName: "Step",
    sequence: 1,
    handoffType: "System",
    cycleTimeHours: 0,
    cost: 0,
    bottleneck: false,
    notes: "",
    ...overrides,
  };
}

describe("computeBaselineSummary", () => {
  it("returns zeros for an empty step list", () => {
    expect(computeBaselineSummary([])).toEqual({
      totalCycleTimeHours: 0,
      totalCost: 0,
      bottleneckCount: 0,
    });
  });

  it("sums cycle time and cost, and counts bottlenecks", () => {
    const steps = [
      makeStep({ cycleTimeHours: 4, cost: 100, bottleneck: true }),
      makeStep({ cycleTimeHours: 2.5, cost: 50, bottleneck: false }),
      makeStep({ cycleTimeHours: 1, cost: 25, bottleneck: true }),
    ];
    expect(computeBaselineSummary(steps)).toEqual({
      totalCycleTimeHours: 7.5,
      totalCost: 175,
      bottleneckCount: 2,
    });
  });
});
