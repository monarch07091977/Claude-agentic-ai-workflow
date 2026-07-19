import { PhaseTabs } from "@/components/PhaseTabs";
import { BaselineSummary } from "@/components/BaselineSummary";
import { StepTable } from "@/components/StepTable";
import { listStepsForProcess } from "@/lib/notion/steps";

export const revalidate = 10;

export default async function Phase1Page({ params }: { params: { id: string } }) {
  const steps = await listStepsForProcess(params.id);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <PhaseTabs processId={params.id} activePhase={1} />
      <h2 className="mb-4 text-lg font-semibold">Process Deconstruction</h2>
      <BaselineSummary steps={steps} />
      <StepTable processId={params.id} steps={steps} />
    </main>
  );
}
