import { describe, it, expect } from "vitest";
import {
  computeBaselineSummary,
  computeSuitabilityScore,
  classifySuitability,
} from "./scoring";
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

describe("computeSuitabilityScore", () => {
  it("weights decision logic at 0.5 and the other two inputs at 0.25 each", () => {
    const score = computeSuitabilityScore({
      dataComplexity: 1,
      decisionLogic: 5,
      contextVolatility: 3,
    });
    expect(score).toBe(3.5);
  });

  it("weights all-equal inputs to the same value", () => {
    const score = computeSuitabilityScore({
      dataComplexity: 4,
      decisionLogic: 4,
      contextVolatility: 4,
    });
    expect(score).toBe(4);
  });
});

describe("classifySuitability", () => {
  it("classifies scores below 2.33 as Algorithmic", () => {
    expect(classifySuitability(1)).toBe("Algorithmic");
    expect(classifySuitability(2.32)).toBe("Algorithmic");
  });

  it("classifies scores from 2.33 to 3.67 inclusive as Agentic", () => {
    expect(classifySuitability(2.33)).toBe("Agentic");
    expect(classifySuitability(3)).toBe("Agentic");
    expect(classifySuitability(3.67)).toBe("Agentic");
  });

  it("classifies scores above 3.67 as Human-required", () => {
    expect(classifySuitability(3.68)).toBe("Human-required");
    expect(classifySuitability(5)).toBe("Human-required");
  });
});
