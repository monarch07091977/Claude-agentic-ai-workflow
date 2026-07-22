"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { StepRecord } from "@/lib/notion/steps";
import type { SuitabilityScoreRecord } from "@/lib/notion/suitability";
import { computeSuitabilityScore, classifySuitability } from "@/lib/scoring";

interface RowInputs {
  dataComplexity: number;
  decisionLogic: number;
  contextVolatility: number;
}

function buildInitialInputs(
  steps: StepRecord[],
  scores: SuitabilityScoreRecord[]
): Record<string, RowInputs> {
  const inputs: Record<string, RowInputs> = {};
  for (const step of steps) {
    const existing = scores.find((score) => score.stepId === step.id);
    inputs[step.id] = {
      dataComplexity: existing?.dataComplexity ?? 3,
      decisionLogic: existing?.decisionLogic ?? 3,
      contextVolatility: existing?.contextVolatility ?? 3,
    };
  }
  return inputs;
}

export function SuitabilityForm({
  processId,
  steps,
  scores,
}: {
  processId: string;
  steps: StepRecord[];
  scores: SuitabilityScoreRecord[];
}) {
  const router = useRouter();
  const [inputs, setInputs] = useState<Record<string, RowInputs>>(
    buildInitialInputs(steps, scores)
  );
  const [savingStepIds, setSavingStepIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [suggestingStepIds, setSuggestingStepIds] = useState<Set<string>>(new Set());
  const [rationales, setRationales] = useState<Record<string, string>>({});

  function updateInput(stepId: string, field: keyof RowInputs, value: number) {
    setInputs((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], [field]: value },
    }));
  }

  async function handleSuggest(stepId: string) {
    setSuggestingStepIds((prev) => new Set(prev).add(stepId));
    setError(null);
    try {
      const response = await fetch("/api/ai/suggest-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Failed to generate a score suggestion");
        return;
      }
      setInputs((prev) => ({
        ...prev,
        [stepId]: {
          dataComplexity: body.dataComplexity,
          decisionLogic: body.decisionLogic,
          contextVolatility: body.contextVolatility,
        },
      }));
      setRationales((prev) => ({ ...prev, [stepId]: body.rationale }));
    } catch {
      setError("Failed to generate a score suggestion");
    } finally {
      setSuggestingStepIds((prev) => {
        const next = new Set(prev);
        next.delete(stepId);
        return next;
      });
    }
  }

  async function handleSave(stepId: string) {
    setSavingStepIds((prev) => new Set(prev).add(stepId));
    setError(null);
    try {
      const response = await fetch("/api/suitability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId, ...inputs[stepId] }),
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Failed to save score");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to save score");
    } finally {
      setSavingStepIds((prev) => {
        const next = new Set(prev);
        next.delete(stepId);
        return next;
      });
    }
  }

  if (steps.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Add steps in Phase 1 before scoring agentic suitability.
      </p>
    );
  }

  return (
    <div>
      <table className="mb-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">Step</th>
            <th>Data Complexity</th>
            <th>Decision Logic</th>
            <th>Context Volatility</th>
            <th>Score</th>
            <th>Classification</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => {
            const rowInputs = inputs[step.id];
            const score = computeSuitabilityScore(rowInputs);
            const classification = classifySuitability(score);
            return (
              <React.Fragment key={step.id}>
                <tr className="border-b border-slate-100">
                  <td className="py-2">{step.stepName}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className="w-16 rounded border border-slate-300 p-1"
                      value={rowInputs.dataComplexity}
                      onChange={(e) =>
                        updateInput(step.id, "dataComplexity", Number(e.target.value))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className="w-16 rounded border border-slate-300 p-1"
                      value={rowInputs.decisionLogic}
                      onChange={(e) =>
                        updateInput(step.id, "decisionLogic", Number(e.target.value))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className="w-16 rounded border border-slate-300 p-1"
                      value={rowInputs.contextVolatility}
                      onChange={(e) =>
                        updateInput(step.id, "contextVolatility", Number(e.target.value))
                      }
                    />
                  </td>
                  <td>{score.toFixed(2)}</td>
                  <td>{classification}</td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      disabled={suggestingStepIds.has(step.id)}
                      onClick={() => handleSuggest(step.id)}
                      className="rounded border border-brand-700 px-2 py-1 text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                    >
                      {suggestingStepIds.has(step.id) ? "Thinking..." : "Suggest"}
                    </button>
                    <button
                      type="button"
                      disabled={savingStepIds.has(step.id)}
                      onClick={() => handleSave(step.id)}
                      className="rounded bg-brand-700 px-3 py-1 text-white hover:bg-brand-900 disabled:opacity-50"
                    >
                      {savingStepIds.has(step.id) ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
                {rationales[step.id] && (
                  <tr className="border-b border-slate-100">
                    <td colSpan={7} className="pb-2 text-xs text-slate-500">
                      {rationales[step.id]}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
