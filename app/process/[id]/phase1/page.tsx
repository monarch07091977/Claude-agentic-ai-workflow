import { PhaseTabs } from "@/components/PhaseTabs";
import { BaselineSummary } from "@/components/BaselineSummary";
import { StepImportForm } from "@/components/StepImportForm";
import { StepTable } from "@/components/StepTable";
import { listStepsForProcess, type StepRecord } from "@/lib/notion/steps";

export const revalidate = 10;

export default async function Phase1Page({ params }: { params: { id: string } }) {
  let steps: StepRecord[] = [];
  let error: string | null = null;
  try {
    steps = await listStepsForProcess(params.id);
  } catch {
    error = "Failed to load process steps. Please try again.";
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <PhaseTabs processId={params.id} activePhase={1} />
      <h2 className="mb-4 text-lg font-semibold">Process Deconstruction</h2>
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </p>
      ) : (
        <>
          <BaselineSummary steps={steps} />
          <StepImportForm processId={params.id} />
          <StepTable processId={params.id} steps={steps} />
        </>
      )}
    </main>
  );
}
