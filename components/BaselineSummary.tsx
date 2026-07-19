import { computeBaselineSummary } from "@/lib/scoring";
import type { StepRecord } from "@/lib/notion/steps";

export function BaselineSummary({ steps }: { steps: StepRecord[] }) {
  const summary = computeBaselineSummary(steps);
  return (
    <div className="mb-6 grid grid-cols-3 gap-4">
      <div className="rounded border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Total Cycle Time</p>
        <p className="text-xl font-semibold">{summary.totalCycleTimeHours} hrs</p>
      </div>
      <div className="rounded border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Total Cost</p>
        <p className="text-xl font-semibold">${summary.totalCost}</p>
      </div>
      <div className="rounded border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Bottlenecks</p>
        <p className="text-xl font-semibold">{summary.bottleneckCount}</p>
      </div>
    </div>
  );
}
