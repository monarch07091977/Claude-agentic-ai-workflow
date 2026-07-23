"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { StepRecord } from "@/lib/notion/steps";
import type { SuitabilityScoreRecord } from "@/lib/notion/suitability";
import { computeSuitabilityScore, classifySuitability } from "@/lib/scoring";
import type { StepQuestion, QuestionDimension } from "@/lib/ai/stepQuestions";

interface RowInputs {
  dataComplexity: number;
  decisionLogic: number;
  contextVolatility: number;
}

const DIMENSION_LABELS: Record<QuestionDimension, string> = {
  dataComplexity: "Data Complexity",
  decisionLogic: "Decision Logic",
  contextVolatility: "Context Volatility",
};

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
  const [questionsByStepId, setQuestionsByStepId] = useState<
    Record<string, StepQuestion[]>
  >({});
  const [answersByStepId, setAnswersByStepId] = useState<
    Record<string, Record<number, string>>
  >({});
  const [loadingQuestionsStepIds, setLoadingQuestionsStepIds] = useState<Set<string>>(
    new Set()
  );
  const [scoringFromAnswersStepIds, setScoringFromAnswersStepIds] = useState<Set<string>>(
    new Set()
  );

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

  async function handleDeepDive(stepId: string) {
    setLoadingQuestionsStepIds((prev) => new Set(prev).add(stepId));
    setError(null);
    try {
      const response = await fetch("/api/ai/step-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Failed to generate questions");
        return;
      }
      setQuestionsByStepId((prev) => ({ ...prev, [stepId]: body.questions }));
      setAnswersByStepId((prev) => ({ ...prev, [stepId]: {} }));
    } catch {
      setError("Failed to generate questions");
    } finally {
      setLoadingQuestionsStepIds((prev) => {
        const next = new Set(prev);
        next.delete(stepId);
        return next;
      });
    }
  }

  function handleAnswerChange(stepId: string, index: number, value: string) {
    setAnswersByStepId((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], [index]: value },
    }));
  }

  async function handleScoreFromAnswers(stepId: string) {
    const questions = questionsByStepId[stepId] ?? [];
    const answers = answersByStepId[stepId] ?? {};
    setScoringFromAnswersStepIds((prev) => new Set(prev).add(stepId));
    setError(null);
    try {
      const response = await fetch("/api/ai/score-from-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId,
          answers: questions.map((q, i) => ({
            dimension: q.dimension,
            question: q.question,
            answer: answers[i] ?? "",
          })),
        }),
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
      setScoringFromAnswersStepIds((prev) => {
        const next = new Set(prev);
        next.delete(stepId);
        return next;
      });
    }
  }

  function buildAssessmentQA(stepId: string): string | undefined {
    const questions = questionsByStepId[stepId];
    if (!questions) return undefined;
    const answers = answersByStepId[stepId] ?? {};
    const hasAnyAnswer = questions.some((_, i) => (answers[i] ?? "").trim() !== "");
    if (!hasAnyAnswer) return undefined;
    return questions
      .map((q, i) => `Q (${q.dimension}): ${q.question}\nA: ${answers[i] ?? ""}`)
      .join("\n\n");
  }

  async function handleSave(stepId: string) {
    setSavingStepIds((prev) => new Set(prev).add(stepId));
    setError(null);
    try {
      const assessmentQA = buildAssessmentQA(stepId);
      const response = await fetch("/api/suitability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId,
          ...inputs[stepId],
          ...(assessmentQA !== undefined ? { assessmentQA } : {}),
        }),
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
            const questions = questionsByStepId[step.id];
            const answers = answersByStepId[step.id] ?? {};
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
                      disabled={loadingQuestionsStepIds.has(step.id)}
                      onClick={() => handleDeepDive(step.id)}
                      className="rounded border border-brand-700 px-2 py-1 text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                    >
                      {loadingQuestionsStepIds.has(step.id) ? "Thinking..." : "Deep dive"}
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
                {questions && (
                  <tr className="border-b border-slate-100">
                    <td colSpan={7} className="bg-slate-50 p-3">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {(
                          [
                            "dataComplexity",
                            "decisionLogic",
                            "contextVolatility",
                          ] as QuestionDimension[]
                        ).map((dimension) => (
                          <div key={dimension}>
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                              {DIMENSION_LABELS[dimension]}
                            </p>
                            {questions
                              .map((q, i) => ({ ...q, index: i }))
                              .filter((q) => q.dimension === dimension)
                              .map((q) => (
                                <div key={q.index} className="mb-2">
                                  <label className="block text-xs text-slate-600">
                                    {q.question}
                                  </label>
                                  <textarea
                                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                                    rows={2}
                                    value={answers[q.index] ?? ""}
                                    onChange={(e) =>
                                      handleAnswerChange(step.id, q.index, e.target.value)
                                    }
                                  />
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={scoringFromAnswersStepIds.has(step.id)}
                        onClick={() => handleScoreFromAnswers(step.id)}
                        className="mt-2 rounded bg-brand-700 px-3 py-1.5 text-sm text-white hover:bg-brand-900 disabled:opacity-50"
                      >
                        {scoringFromAnswersStepIds.has(step.id)
                          ? "Scoring..."
                          : "Score from answers"}
                      </button>
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
