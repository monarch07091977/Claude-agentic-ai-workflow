"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ImportResult {
  imported: number;
  skipped: { row: number; reason: string }[];
}

export function StepImportForm({ processId }: { processId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a .xlsx file first");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("processId", processId);
      formData.append("file", file);
      const response = await fetch("/api/steps/import", {
        method: "POST",
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Failed to import steps");
        return;
      }
      setResult(body);
      setFile(null);
      router.refresh();
    } catch {
      setError("Failed to import steps");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-6 rounded border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Import steps from a spreadsheet</p>
        <a
          href="/api/steps/template"
          className="text-xs text-slate-500 underline hover:text-slate-700"
        >
          Download template
        </a>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <input
          type="file"
          accept=".xlsx"
          className="text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {submitting ? "Importing..." : "Import Steps"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {result && (
        <p className="mt-2 text-sm text-slate-500">
          Imported {result.imported} step{result.imported === 1 ? "" : "s"}
          {result.skipped.length > 0 ? `, skipped ${result.skipped.length}: ` : "."}
          {result.skipped.length > 0 &&
            result.skipped.map((s) => `row ${s.row} (${s.reason})`).join("; ")}
        </p>
      )}
    </div>
  );
}
