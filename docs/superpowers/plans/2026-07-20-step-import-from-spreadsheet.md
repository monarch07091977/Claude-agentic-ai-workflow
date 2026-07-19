# Step Import from Spreadsheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a consultant bulk-add Phase 1 process steps by downloading a pre-formatted `.xlsx` template, filling it in, and uploading it — instead of typing each step into the form one at a time.

**Architecture:** Same as the four phase plans — Notion as the sole data store, a pure/testable parsing function separated from the I/O-heavy route handler (mirrors `lib/scoring.ts`/`lib/orchestration.ts` vs. their route glue), client component with the established try/catch/finally error-reset guarantee.

**Tech Stack:** Adds one new dependency, `exceljs`, for reading and generating `.xlsx` files server-side. (Not `xlsx`/SheetJS — that package has known unpatched ReDoS/prototype-pollution advisories on the versions published to npm; `exceljs` is the actively-maintained alternative and is what this plan uses for both reading uploaded files and generating the template.)

## Global Constraints

- Data store is Notion only — no separate database (spec: Architecture).
- Notion integration token lives server-side only, via `NOTION_TOKEN` env var, never sent to the client.
- Every API route response path must return JSON (existing project convention) — except the template-download route, which is a binary file download by design (documented explicitly in Task 3).
- Every client-side fetch that can fail must guarantee a visible error AND reset its submitting/disabled state on all three paths (success, non-ok response, network rejection) via try/catch/finally.
- Scope: `.xlsx` only (matches the consultant's real source files) — no `.csv` support in this plan. Import only adds new steps to an already-existing process; it never creates a process or edits/deletes existing steps.
- Malformed rows are skipped with a reported reason, never silently dropped and never failing the whole import — the response always states how many rows were imported and how many were skipped, with why.

---

### Task 1: Add exceljs and step-row parsing logic

**Files:**
- Modify: `package.json` (add `exceljs` dependency)
- Create: `lib/importSteps.ts`
- Create: `lib/importSteps.test.ts`

**Interfaces:**
- Produces: `interface ParsedStepRow { stepName: string; handoffType: string; cycleTimeHours: number; cost: number; bottleneck: boolean; notes: string }`, `interface SkippedRow { row: number; reason: string }`, `parseStepRows(rows: unknown[][]): { valid: ParsedStepRow[]; skipped: SkippedRow[] }` from `lib/importSteps.ts` — consumed by Task 2 (import route). Pure function, no exceljs/Notion dependency — takes plain rows (row 0 = header) and returns validated/normalized data.

- [ ] **Step 1: Add `exceljs` to `package.json`**

Find the `"dependencies"` object and replace its contents with the block below (adds one new line, `"exceljs": "^4.4.0"`, in alphabetical order — every other key in the file stays exactly as-is):

```json
  "dependencies": {
    "@notionhq/client": "^2.2.15",
    "exceljs": "^4.4.0",
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7"
  },
```

- [ ] **Step 2: Install the new dependency**

Run: `npm install`
Expected: exits 0, `exceljs` added to `package-lock.json`.

- [ ] **Step 3: Write the failing tests**

Create `lib/importSteps.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseStepRows } from "./importSteps";

describe("parseStepRows", () => {
  it("returns empty results for an empty sheet", () => {
    expect(parseStepRows([])).toEqual({ valid: [], skipped: [] });
  });

  it("skips everything with a clear reason when the Step Name column is missing", () => {
    const rows = [["Cost", "Cycle Time (hrs)"], [100, 4]];
    const result = parseStepRows(rows);
    expect(result.valid).toEqual([]);
    expect(result.skipped).toEqual([
      { row: 0, reason: "Missing required 'Step Name' column in header row" },
    ]);
  });

  it("parses a fully-populated row", () => {
    const rows = [
      ["Step Name", "Handoff Type", "Cycle Time (hrs)", "Cost", "Bottleneck", "Notes"],
      ["Submit requisition", "Human", 4, 100, "Yes", "Manual approval"],
    ];
    const result = parseStepRows(rows);
    expect(result.valid).toEqual([
      {
        stepName: "Submit requisition",
        handoffType: "Human",
        cycleTimeHours: 4,
        cost: 100,
        bottleneck: true,
        notes: "Manual approval",
      },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("skips a row with a blank Step Name and reports its row number", () => {
    const rows = [
      ["Step Name", "Cost"],
      ["", 50],
      ["Approve", 25],
    ];
    const result = parseStepRows(rows);
    expect(result.valid).toEqual([
      {
        stepName: "Approve",
        handoffType: "System",
        cycleTimeHours: 0,
        cost: 25,
        bottleneck: false,
        notes: "",
      },
    ]);
    expect(result.skipped).toEqual([{ row: 1, reason: "Missing Step Name" }]);
  });

  it("falls back to 'System' for an unrecognized Handoff Type", () => {
    const rows = [
      ["Step Name", "Handoff Type"],
      ["Review", "Robot"],
    ];
    const result = parseStepRows(rows);
    expect(result.valid[0].handoffType).toBe("System");
  });

  it("falls back to 0 for non-numeric Cycle Time and Cost", () => {
    const rows = [
      ["Step Name", "Cycle Time (hrs)", "Cost"],
      ["Review", "n/a", "unknown"],
    ];
    const result = parseStepRows(rows);
    expect(result.valid[0].cycleTimeHours).toBe(0);
    expect(result.valid[0].cost).toBe(0);
  });

  it("recognizes common truthy spellings for Bottleneck and treats everything else as false", () => {
    const rows = [
      ["Step Name", "Bottleneck"],
      ["A", "Yes"],
      ["B", "TRUE"],
      ["C", "1"],
      ["D", "No"],
      ["E", ""],
    ];
    const result = parseStepRows(rows);
    expect(result.valid.map((r) => r.bottleneck)).toEqual([true, true, true, false, false]);
  });

  it("matches headers case-insensitively and trims whitespace", () => {
    const rows = [
      [" step name ", " COST "],
      ["Review", 30],
    ];
    const result = parseStepRows(rows);
    expect(result.valid).toEqual([
      {
        stepName: "Review",
        handoffType: "System",
        cycleTimeHours: 0,
        cost: 30,
        bottleneck: false,
        notes: "",
      },
    ]);
  });

  it("applies defaults when optional columns are absent entirely", () => {
    const rows = [["Step Name"], ["Just a name"]];
    const result = parseStepRows(rows);
    expect(result.valid).toEqual([
      {
        stepName: "Just a name",
        handoffType: "System",
        cycleTimeHours: 0,
        cost: 0,
        bottleneck: false,
        notes: "",
      },
    ]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run lib/importSteps.test.ts`
Expected: FAIL — `Cannot find module './importSteps'`.

- [ ] **Step 5: Implement `lib/importSteps.ts`**

```ts
export interface ParsedStepRow {
  stepName: string;
  handoffType: string;
  cycleTimeHours: number;
  cost: number;
  bottleneck: boolean;
  notes: string;
}

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface ParseStepRowsResult {
  valid: ParsedStepRow[];
  skipped: SkippedRow[];
}

const VALID_HANDOFF_TYPES = ["System", "Human", "Cross-team", "External"];

function findColumn(header: string[], names: string[]): number {
  return header.findIndex((h) => names.includes(h));
}

export function parseStepRows(rows: unknown[][]): ParseStepRowsResult {
  if (rows.length === 0) {
    return { valid: [], skipped: [] };
  }

  const header = rows[0].map((cell) => String(cell ?? "").trim().toLowerCase());

  const stepNameCol = findColumn(header, ["step name", "name"]);
  const handoffTypeCol = findColumn(header, ["handoff type", "handoff"]);
  const cycleTimeCol = findColumn(header, [
    "cycle time (hrs)",
    "cycle time",
    "cycle time hrs",
  ]);
  const costCol = findColumn(header, ["cost"]);
  const bottleneckCol = findColumn(header, ["bottleneck"]);
  const notesCol = findColumn(header, ["notes"]);

  if (stepNameCol === -1) {
    return {
      valid: [],
      skipped: [{ row: 0, reason: "Missing required 'Step Name' column in header row" }],
    };
  }

  const valid: ParsedStepRow[] = [];
  const skipped: SkippedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i;
    const stepName = String(row[stepNameCol] ?? "").trim();
    if (!stepName) {
      skipped.push({ row: rowNumber, reason: "Missing Step Name" });
      continue;
    }

    const rawHandoffType =
      handoffTypeCol >= 0 ? String(row[handoffTypeCol] ?? "").trim() : "";
    const handoffType = VALID_HANDOFF_TYPES.includes(rawHandoffType)
      ? rawHandoffType
      : "System";

    const cycleTimeHours = cycleTimeCol >= 0 ? Number(row[cycleTimeCol]) || 0 : 0;
    const cost = costCol >= 0 ? Number(row[costCol]) || 0 : 0;

    const rawBottleneck =
      bottleneckCol >= 0 ? String(row[bottleneckCol] ?? "").trim().toLowerCase() : "";
    const bottleneck = ["yes", "true", "1"].includes(rawBottleneck);

    const notes = notesCol >= 0 ? String(row[notesCol] ?? "").trim() : "";

    valid.push({ stepName, handoffType, cycleTimeHours, cost, bottleneck, notes });
  }

  return { valid, skipped };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/importSteps.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/importSteps.ts lib/importSteps.test.ts
git commit -m "feat: add spreadsheet row parsing logic for step import"
```

---

### Task 2: Steps import API route

**Files:**
- Create: `app/api/steps/import/route.ts`

**Interfaces:**
- Consumes: `parseStepRows` (Task 1), `listStepsForProcess`, `createStep` (`lib/notion/steps.ts`).
- Produces: `POST /api/steps/import` — accepts `multipart/form-data` with a `processId` field and a `file` field (the uploaded `.xlsx`). Returns `200 { imported: number, skipped: SkippedRow[] }` on success (including partial success — some rows skipped), or `400`/`500 { error: string }`.

- [ ] **Step 1: Implement `app/api/steps/import/route.ts`**

```ts
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createStep, listStepsForProcess } from "@/lib/notion/steps";
import { parseStepRows } from "@/lib/importSteps";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const processId = formData.get("processId");
  const file = formData.get("file");

  if (typeof processId !== "string" || !processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  let rows: unknown[][];
  try {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: "Spreadsheet has no worksheet" }, { status: 400 });
    }
    rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[];
      rows.push(values.slice(1));
    });
  } catch {
    return NextResponse.json({ error: "Failed to read spreadsheet file" }, { status: 400 });
  }

  const { valid, skipped } = parseStepRows(rows);

  try {
    const existingSteps = await listStepsForProcess(processId);
    let sequence = existingSteps.length;
    let importedCount = 0;
    for (const row of valid) {
      sequence += 1;
      await createStep({
        processId,
        stepName: row.stepName,
        sequence,
        handoffType: row.handoffType,
        cycleTimeHours: row.cycleTimeHours,
        cost: row.cost,
        bottleneck: row.bottleneck,
        notes: row.notes,
      });
      importedCount += 1;
    }
    return NextResponse.json({ imported: importedCount, skipped }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to import steps" }, { status: 500 });
  }
}
```

Note on `row.values`: ExcelJS's `Row.values` is 1-indexed (index 0 is always `undefined`), so `.slice(1)` converts it to a plain 0-indexed array matching what `parseStepRows` expects — the same indexing `parseStepRows`'s own header-row array uses.

Note on sequencing: steps are numbered continuing from the process's current step count (`existingSteps.length`), matching the existing "Add Step" form's `steps.length + 1` convention — imported rows land after whatever's already there, in the order they appear in the sheet.

Note on partial failure: if `createStep` throws partway through the loop (e.g. on row 5 of 10), the whole request fails with a 500 and rows 1-4 remain created in Notion (already-written pages are not rolled back). This is an accepted limitation for v1 — Notion's API has no multi-write transaction primitive, and the existing project pattern (e.g. `upsertSuitabilityScore`'s self-healing duplicate guard) already treats partial-write scenarios as something to tolerate rather than fully prevent.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors. (This route has no automated test — it's I/O glue around the already-tested `parseStepRows` and `lib/notion/steps.ts` functions, verified manually end-to-end once this plan's final task lands.)

- [ ] **Step 3: Commit**

```bash
git add "app/api/steps/import/route.ts"
git commit -m "feat: add step import API route"
```

---

### Task 3: Step template download route

**Files:**
- Create: `app/api/steps/template/route.ts`

**Interfaces:**
- Produces: `GET /api/steps/template` — returns a generated `.xlsx` file as a binary download (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment`). This route intentionally does NOT return JSON — it's a file download, not a data API, so the project's "every route returns JSON" convention does not apply here (this is a deliberate, documented exception, not an oversight).

- [ ] **Step 1: Implement `app/api/steps/template/route.ts`**

```ts
import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Process Steps");
  worksheet.columns = [
    { header: "Step Name", key: "stepName", width: 30 },
    { header: "Handoff Type", key: "handoffType", width: 16 },
    { header: "Cycle Time (hrs)", key: "cycleTimeHours", width: 18 },
    { header: "Cost", key: "cost", width: 12 },
    { header: "Bottleneck", key: "bottleneck", width: 12 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  worksheet.addRow({
    stepName: "Submit requisition",
    handoffType: "Human",
    cycleTimeHours: 4,
    cost: 100,
    bottleneck: "No",
    notes: "Manager reviews and approves the request",
  });
  worksheet.getRow(1).font = { bold: true };

  for (let row = 2; row <= 200; row++) {
    worksheet.getCell(`B${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"System,Human,Cross-team,External"'],
    };
    worksheet.getCell(`E${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Yes,No"'],
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="process-steps-template.xlsx"',
    },
  });
}
```

The `Handoff Type` column (B) and `Bottleneck` column (E) get dropdown-list data validation for rows 2-200, so a consultant filling in the template picks from a fixed list instead of free-typing values that might not match what `parseStepRows` recognizes (e.g. typing "human" lowercase would otherwise silently fall back to "System").

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/steps/template/route.ts"
git commit -m "feat: add step import template download route"
```

---

### Task 4: Step import form component

**Files:**
- Create: `components/StepImportForm.tsx`

**Interfaces:**
- Consumes: `POST /api/steps/import` (Task 2), `GET /api/steps/template` (Task 3, linked directly, not fetched).
- Produces: `StepImportForm({ processId }: { processId: string })` component, consumed by Task 5.

- [ ] **Step 1: Implement `components/StepImportForm.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add components/StepImportForm.tsx
git commit -m "feat: add step import form with template download link"
```

---

### Task 5: Wire into Phase 1 page

**Files:**
- Modify: `app/process/[id]/phase1/page.tsx`

**Interfaces:**
- Consumes: `StepImportForm` (Task 4).
- Produces: the Phase 1 tab now shows the import form (with its template-download link) between the baseline summary and the step table.

- [ ] **Step 1: Replace `app/process/[id]/phase1/page.tsx`**

Replace the full file with:

```tsx
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
```

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (client, config, processes, steps, scoring, suitability, orchestration, agents, metrics, importSteps).

- [ ] **Step 3: Manually verify the full end-to-end flow (controller/user, against the live Notion workspace)**

1. Open an existing process's Phase 1 tab.
2. Click "Download template" — confirm a `process-steps-template.xlsx` file downloads with headers Step Name/Handoff Type/Cycle Time (hrs)/Cost/Bottleneck/Notes, one example row, and dropdown lists on the Handoff Type and Bottleneck columns.
3. In the downloaded file, edit the example row and add 2-3 more rows (leave one row's Step Name blank to test skip behavior).
4. Upload the edited file via "Import Steps".
5. Confirm the result line reports the correct imported/skipped counts, and the skip reason for the blank-name row.
6. Confirm the new steps appear in the table below (in sheet order, sequenced after any pre-existing steps) and the baseline summary updates accordingly.
7. Reload the page — confirm the imported steps persisted.

Expected: all values match the uploaded sheet; no console errors.

- [ ] **Step 4: Commit**

```bash
git add "app/process/[id]/phase1/page.tsx"
git commit -m "feat: wire step import form into Phase 1 page"
```
