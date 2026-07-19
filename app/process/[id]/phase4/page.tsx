import { PhaseTabs } from "@/components/PhaseTabs";
import { MetricsChart } from "@/components/MetricsChart";
import { MetricCards } from "@/components/MetricCards";
import { MetricForm } from "@/components/MetricForm";
import { listMetricsForProcess, type MetricRecord } from "@/lib/notion/metrics";

export const revalidate = 10;

export default async function Phase4Page({ params }: { params: { id: string } }) {
  let metrics: MetricRecord[] = [];
  let error: string | null = null;
  try {
    metrics = await listMetricsForProcess(params.id);
  } catch {
    error = "Failed to load value metrics. Please try again.";
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <PhaseTabs processId={params.id} activePhase={4} />
      <h2 className="mb-4 text-lg font-semibold">
        Value Realization and Business Impact Measurement
      </h2>
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </p>
      ) : (
        <>
          <MetricCards metrics={metrics} />
          <MetricsChart metrics={metrics} />
          <MetricForm processId={params.id} />
        </>
      )}
    </main>
  );
}
