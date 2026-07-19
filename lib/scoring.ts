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

export interface SuitabilityInputs {
  dataComplexity: number;
  decisionLogic: number;
  contextVolatility: number;
}

export function computeSuitabilityScore(inputs: SuitabilityInputs): number {
  return (
    inputs.decisionLogic * 0.5 +
    inputs.dataComplexity * 0.25 +
    inputs.contextVolatility * 0.25
  );
}

export type SuitabilityClassification = "Algorithmic" | "Agentic" | "Human-required";

export function classifySuitability(score: number): SuitabilityClassification {
  if (score < 2.33) return "Algorithmic";
  if (score <= 3.67) return "Agentic";
  return "Human-required";
}

export interface MetricProgressInputs {
  baseline: number;
  current: number;
  target: number;
}

export function computeMetricProgress(metric: MetricProgressInputs): number {
  if (metric.target === metric.baseline) return 0;
  const progress = (metric.current - metric.baseline) / (metric.target - metric.baseline);
  return Math.max(0, Math.min(1, progress)) * 100;
}
