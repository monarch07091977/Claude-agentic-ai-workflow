import { computeMetricProgress } from "@/lib/scoring";
import type { MetricRecord } from "@/lib/notion/metrics";

export function MetricCards({ metrics }: { metrics: MetricRecord[] }) {
  if (metrics.length === 0) {
    return (
      <p className="mb-6 text-sm text-slate-500">
        No value metrics yet. Add one below to start tracking impact.
      </p>
    );
  }

  return (
    <div className="mb-6 grid grid-cols-2 gap-4">
      {metrics.map((metric) => {
        const progress = computeMetricProgress(metric);
        return (
          <div key={metric.id} className="rounded border border-slate-200 p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-medium">{metric.metricName}</p>
              <span className="text-xs text-slate-500">{metric.category}</span>
            </div>
            <p className="mb-2 text-sm text-slate-500">
              {metric.baseline} {metric.unit} &rarr; {metric.current} {metric.unit}{" "}
              (target {metric.target} {metric.unit})
            </p>
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-brand-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">{progress.toFixed(0)}% of target</p>
          </div>
        );
      })}
    </div>
  );
}
