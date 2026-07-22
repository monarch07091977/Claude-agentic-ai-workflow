"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["Cycle Time", "Cost", "Quality", "Human Hours Reallocated"] as const;

export function MetricForm({ processId }: { processId: string }) {
  const router = useRouter();
  const [metricName, setMetricName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [baseline, setBaseline] = useState(0);
  const [current, setCurrent] = useState(0);
  const [target, setTarget] = useState(0);
  const [unit, setUnit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          metricName,
          category,
          baseline,
          current,
          target,
          unit,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Failed to add metric");
        return;
      }
      setMetricName("");
      setCategory(CATEGORIES[0]);
      setBaseline(0);
      setCurrent(0);
      setTarget(0);
      setUnit("");
      router.refresh();
    } catch {
      setError("Failed to add metric");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-slate-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500">Metric Name</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={metricName}
            onChange={(e) => setMetricName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Category</label>
          <select
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Baseline</label>
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={baseline}
            onChange={(e) => setBaseline(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Current</label>
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={current}
            onChange={(e) => setCurrent(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Target</label>
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Unit</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. hrs, $, %"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-brand-700 px-4 py-1.5 text-sm text-white hover:bg-brand-900 disabled:opacity-50"
      >
        {submitting ? "Adding..." : "Add Metric"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
