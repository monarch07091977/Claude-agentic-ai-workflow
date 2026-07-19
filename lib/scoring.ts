import type { StepRecord } from "./notion/steps";

export interface BaselineSummary {
  totalCycleTimeHours: number;
  totalCost: number;
  bottleneckCount: number;
}

export function computeBaselineSummary(steps: StepRecord[]): BaselineSummary {
  return steps.reduce(
    (summary, step) => ({
      totalCycleTimeHours: summary.totalCycleTimeHours + step.cycleTimeHours,
      totalCost: summary.totalCost + step.cost,
      bottleneckCount: summary.bottleneckCount + (step.bottleneck ? 1 : 0),
    }),
    { totalCycleTimeHours: 0, totalCost: 0, bottleneckCount: 0 }
  );
}
