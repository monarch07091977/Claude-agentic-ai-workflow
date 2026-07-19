import { PhaseTabs } from "@/components/PhaseTabs";
import { SuitabilityChart } from "@/components/SuitabilityChart";
import { SuitabilityForm } from "@/components/SuitabilityForm";
import { listStepsForProcess, type StepRecord } from "@/lib/notion/steps";
import {
  listSuitabilityScoresForSteps,
  type SuitabilityScoreRecord,
} from "@/lib/notion/suitability";

export const revalidate = 10;

export default async function Phase2Page({ params }: { params: { id: string } }) {
  let steps: StepRecord[] = [];
  let scores: SuitabilityScoreRecord[] = [];
  let error: string | null = null;
  try {
    steps = await listStepsForProcess(params.id);
    scores = await listSuitabilityScoresForSteps(steps.map((step) => step.id));
  } catch {
    error = "Failed to load suitability data. Please try again.";
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <PhaseTabs processId={params.id} activePhase={2} />
      <h2 className="mb-4 text-lg font-semibold">
        Cognitive Load and Automation Potential Assessment
      </h2>
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </p>
      ) : (
        <>
          <SuitabilityChart steps={steps} scores={scores} />
          <div className="mt-6">
            <SuitabilityForm processId={params.id} steps={steps} scores={scores} />
          </div>
        </>
      )}
    </main>
  );
}
