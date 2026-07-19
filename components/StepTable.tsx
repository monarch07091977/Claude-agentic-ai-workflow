"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StepRecord } from "@/lib/notion/steps";

export function StepTable({
  processId,
  steps,
}: {
  processId: string;
  steps: StepRecord[];
}) {
  const router = useRouter();
  const [stepName, setStepName] = useState("");
  const [cycleTimeHours, setCycleTimeHours] = useState(0);
  const [cost, setCost] = useState(0);
  const [bottleneck, setBottleneck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddStep(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          stepName,
          sequence: steps.length + 1,
          cycleTimeHours,
          cost,
          bottleneck,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Failed to add step");
        return;
      }
      setStepName("");
      setCycleTimeHours(0);
      setCost(0);
      setBottleneck(false);
      router.refresh();
    } catch {
      setError("Failed to add step");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <table className="mb-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">#</th>
            <th>Step</th>
            <th>Handoff</th>
            <th>Cycle Time (hrs)</th>
            <th>Cost</th>
            <th>Bottleneck</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.id} className="border-b border-slate-100">
              <td className="py-2">{step.sequence}</td>
              <td>{step.stepName}</td>
              <td>{step.handoffType}</td>
              <td>{step.cycleTimeHours}</td>
              <td>{step.cost}</td>
              <td>{step.bottleneck ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={handleAddStep} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500">Step name</label>
          <input
            className="rounded border border-slate-300 p-1"
            value={stepName}
            onChange={(e) => setStepName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Cycle time (hrs)</label>
          <input
            type="number"
            className="w-24 rounded border border-slate-300 p-1"
            value={cycleTimeHours}
            onChange={(e) => setCycleTimeHours(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Cost</label>
          <input
            type="number"
            className="w-24 rounded border border-slate-300 p-1"
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
          />
        </div>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={bottleneck}
            onChange={(e) => setBottleneck(e.target.checked)}
          />
          Bottleneck
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-50"
        >
          Add Step
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
