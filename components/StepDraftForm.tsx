"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedStepRow } from "@/lib/importSteps";

export function StepDraftForm({
  processId,
  existingStepCount,
}: {
  processId: string;
  existingStepCount: number;
}) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftSteps, setDraftSteps] = useState<ParsedStepRow[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!rawText.trim()) {
      setError("Paste a process description first");
      return;
    }
    setDrafting(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/draft-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Failed to draft steps");
        return;
      }
      setDraftSteps(body.steps);
      setSkippedCount(body.skipped.length);
    } catch {
      setError("Failed to draft steps");
    } finally {
      setDrafting(false);
    }
  }

  function updateDraftStep(
    index: number,
    field: keyof ParsedStepRow,
    value: string | number | boolean
  ) {
    setDraftSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, [field]: value } : step))
    );
  }

  function removeDraftStep(index: number) {
    setDraftSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    const remaining = [...draftSteps];
    try {
      let sequence = existingStepCount + 1;
      while (remaining.length > 0) {
        const step = remaining[0];
        const response = await fetch("/api/steps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            processId,
            stepName: step.stepName,
            sequence,
            handoffType: step.handoffType,
            cycleTimeHours: step.cycleTimeHours,
            cost: step.cost,
            bottleneck: step.bottleneck,
            notes: step.notes,
          }),
        });
        if (!response.ok) {
          const body = await response.json();
          setError(body.error ?? "Failed to add drafted steps");
          return;
        }
        remaining.shift();
        sequence += 1;
        setDraftSteps(remaining.slice());
      }
      setRawText("");
      router.refresh();
    } catch {
      setError("Failed to add drafted steps");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 rounded border border-slate-200 p-4">
      <p className="mb-2 text-sm font-medium">Draft steps from text</p>
      <form onSubmit={handleDraft} className="space-y-2">
        <textarea
          className="w-full rounded border border-slate-300 p-2 text-sm"
          rows={4}
          placeholder="Paste an SOP, meeting notes, or a rough description of the process..."
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <button
          type="submit"
          disabled={drafting}
          className="rounded bg-brand-700 px-3 py-1.5 text-sm text-white hover:bg-brand-900 disabled:opacity-50"
        >
          {drafting ? "Drafting..." : "Draft Steps"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {draftSteps.length > 0 && (
        <div className="mt-4">
          {skippedCount > 0 && (
            <p className="mb-2 text-xs text-slate-500">
              Skipped {skippedCount} row{skippedCount === 1 ? "" : "s"} with no step name.
            </p>
          )}
          <table className="mb-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Step</th>
                <th>Handoff</th>
                <th>Cycle Time (hrs)</th>
                <th>Cost</th>
                <th>Bottleneck</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {draftSteps.map((step, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="py-2">
                    <input
                      className="w-full rounded border border-slate-300 p-1"
                      value={step.stepName}
                      onChange={(e) => updateDraftStep(index, "stepName", e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="rounded border border-slate-300 p-1"
                      value={step.handoffType}
                      onChange={(e) => updateDraftStep(index, "handoffType", e.target.value)}
                    >
                      <option value="System">System</option>
                      <option value="Human">Human</option>
                      <option value="Cross-team">Cross-team</option>
                      <option value="External">External</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="w-20 rounded border border-slate-300 p-1"
                      value={step.cycleTimeHours}
                      onChange={(e) =>
                        updateDraftStep(index, "cycleTimeHours", Number(e.target.value))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="w-20 rounded border border-slate-300 p-1"
                      value={step.cost}
                      onChange={(e) => updateDraftStep(index, "cost", Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={step.bottleneck}
                      onChange={(e) => updateDraftStep(index, "bottleneck", e.target.checked)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeDraftStep(index)}
                      className="text-xs text-slate-500 underline hover:text-slate-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className="rounded bg-brand-700 px-3 py-1.5 text-sm text-white hover:bg-brand-900 disabled:opacity-50"
          >
            {saving ? "Adding..." : `Add these ${draftSteps.length} steps`}
          </button>
        </div>
      )}
    </div>
  );
}
