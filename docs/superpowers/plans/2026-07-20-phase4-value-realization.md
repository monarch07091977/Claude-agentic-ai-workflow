# Phase 4 (Value Realization and Business Impact Measurement) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Phase 4 to the app: track baseline/current/target values for named metrics per process (categorized Cycle Time / Cost / Quality / Human Hours Reallocated), show progress toward target as KPI cards, and visualize all metrics on a comparison chart.

**Architecture:** Same as Plans 1-3 — Notion as the sole data store, Server Components for reads with inline error banners on failure, Route Handlers for writes with try/catch guaranteeing a JSON body on every path, client components only where interactivity is needed.

**Tech Stack:** Same as Plans 1-3 (Next.js 14, TypeScript, Tailwind, `@notionhq/client`, Vitest, `recharts` — already a dependency since Plan 2, reused here for the metrics comparison chart). No new npm dependency.

## Global Constraints

- Data store is Notion only — no separate database (spec: Architecture).
- Notion integration token lives server-side only, via `NOTION_TOKEN` env var, never sent to the client (spec: Architecture, Non-goals).
- No user login/auth in v1 (spec: Non-goals).
- Reads use Server Components with short revalidation caching; writes go through Route Handlers directly to Notion (spec: Architecture).
- Notion API failures surface as an inline error banner on the affected screen; the rest of the UI stays usable (spec: Error Handling) — apply this from the start in every Server Component and API route this plan adds, as Plans 1-3 already do.
- All Notion property access in mapping functions (`pageToX` helpers) must use defensive `?.` chaining consistently on every schema-dependent field (`page.id` itself is exempt — it's a guaranteed top-level field on every Notion page object, not a schema-dependent `properties.X` field; this exact distinction was confirmed during Plan 3's review, see `lib/notion/processes.ts`/`steps.ts`/`suitability.ts`/`agents.ts` for the established pattern).
- Every client-side fetch that can fail must guarantee a visible error AND reset its submitting/disabled state on all three paths (success, non-ok HTTP response, network/fetch rejection) via try/catch/finally — established from Plan 1 onward.
- Scope for this plan (decided directly, consistent with the add+read-only precedent already accepted for Phases 1-3): metrics can be added but not edited or deleted in this plan.
- Metric progress formula (decided directly, to correctly handle both "lower is better" metrics like Cost/Cycle Time and "higher is better" metrics like Quality/Human Hours Reallocated with one formula): `progress = clamp((current - baseline) / (target - baseline), 0, 1) * 100`. This works regardless of whether `target > baseline` (improvement = increase) or `target < baseline` (improvement = decrease), since dividing by `(target - baseline)` naturally accounts for the direction. If `target === baseline`, progress is defined as 0 (no target movement to measure against, avoids a divide-by-zero).

---

### Task 1: Extend Notion schema and config for Value Metrics

**Files:**
- Modify: `scripts/setup-notion.ts`
- Modify: `lib/notion/config.ts`
- Modify: `lib/notion/config.test.ts`

**Interfaces:**
- Consumes: `findExistingDatabaseId` (already defined in `scripts/setup-notion.ts`), `processesDbId` (already resolved earlier in the same script).
- Produces: a live Notion "Value Metrics" database once run manually; `notionConfig.valueMetricsDbId` getter (throws `"NOTION_VALUE_METRICS_DB_ID environment variable is not set"` if unset), consumed by Task 3 onward.

- [ ] **Step 1: Add Value Metrics database creation to `scripts/setup-notion.ts`**

Add this block immediately after the existing "Agent Blueprint" `if (agentBlueprintDbId) { ... } else { ... }` block, before the final `console.log` calls:

```ts
  let valueMetricsDbId = await findExistingDatabaseId(notion, parentPageId, "Value Metrics");
  if (valueMetricsDbId) {
    console.log("Value Metrics database already exists, reusing it.");
  } else {
    const valueMetricsDb = await notion.databases.create({
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: "Value Metrics" } }],
      properties: {
        "Metric Name": { title: {} },
        Process: {
          relation: {
            database_id: processesDbId,
            type: "single_property",
            single_property: {},
          },
        },
        Category: {
          select: {
            options: [
              { name: "Cycle Time", color: "blue" },
              { name: "Cost", color: "green" },
              { name: "Quality", color: "purple" },
              { name: "Human Hours Reallocated", color: "orange" },
            ],
          },
        },
        Baseline: { number: { format: "number" } },
        Current: { number: { format: "number" } },
        Target: { number: { format: "number" } },
        Unit: { rich_text: {} },
      },
    });
    valueMetricsDbId = valueMetricsDb.id;
  }
```

Note: this block references `processesDbId`, the variable already established earlier in `main()`. Do not redeclare it.

- [ ] **Step 2: Update the final console.log block**

Change the existing:

```ts
  console.log("Notion setup complete. Add these to your .env.local:\n");
  console.log(`NOTION_PROCESSES_DB_ID=${processesDbId}`);
  console.log(`NOTION_STEPS_DB_ID=${stepsDbId}`);
  console.log(`NOTION_SUITABILITY_DB_ID=${suitabilityDbId}`);
  console.log(`NOTION_AGENT_BLUEPRINT_DB_ID=${agentBlueprintDbId}`);
```

to:

```ts
  console.log("Notion setup complete. Add these to your .env.local:\n");
  console.log(`NOTION_PROCESSES_DB_ID=${processesDbId}`);
  console.log(`NOTION_STEPS_DB_ID=${stepsDbId}`);
  console.log(`NOTION_SUITABILITY_DB_ID=${suitabilityDbId}`);
  console.log(`NOTION_AGENT_BLUEPRINT_DB_ID=${agentBlueprintDbId}`);
  console.log(`NOTION_VALUE_METRICS_DB_ID=${valueMetricsDbId}`);
```

- [ ] **Step 3: Verify the script still type-checks**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 4: Add `valueMetricsDbId` to `lib/notion/config.ts`**

Add this getter to the `notionConfig` object, alongside the existing ones:

```ts
  get valueMetricsDbId() {
    return requireEnv("NOTION_VALUE_METRICS_DB_ID");
  },
```

- [ ] **Step 5: Add a test for `valueMetricsDbId` to `lib/notion/config.test.ts`**

Replace the full file with:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { notionConfig } from "./config";

describe("notionConfig", () => {
  afterEach(() => {
    delete process.env.NOTION_PARENT_PAGE_ID;
    delete process.env.NOTION_PROCESSES_DB_ID;
    delete process.env.NOTION_STEPS_DB_ID;
    delete process.env.NOTION_SUITABILITY_DB_ID;
    delete process.env.NOTION_AGENT_BLUEPRINT_DB_ID;
    delete process.env.NOTION_VALUE_METRICS_DB_ID;
  });

  it("throws when NOTION_PARENT_PAGE_ID is not set", () => {
    delete process.env.NOTION_PARENT_PAGE_ID;
    expect(() => notionConfig.parentPageId).toThrow(
      "NOTION_PARENT_PAGE_ID environment variable is not set"
    );
  });

  it("returns the value when set", () => {
    process.env.NOTION_PARENT_PAGE_ID = "abc123";
    expect(notionConfig.parentPageId).toBe("abc123");
  });

  it("exposes processesDbId, stepsDbId, suitabilityDbId, agentBlueprintDbId, and valueMetricsDbId the same way", () => {
    process.env.NOTION_PROCESSES_DB_ID = "processes-db";
    process.env.NOTION_STEPS_DB_ID = "steps-db";
    process.env.NOTION_SUITABILITY_DB_ID = "suitability-db";
    process.env.NOTION_AGENT_BLUEPRINT_DB_ID = "agent-blueprint-db";
    process.env.NOTION_VALUE_METRICS_DB_ID = "value-metrics-db";
    expect(notionConfig.processesDbId).toBe("processes-db");
    expect(notionConfig.stepsDbId).toBe("steps-db");
    expect(notionConfig.suitabilityDbId).toBe("suitability-db");
    expect(notionConfig.agentBlueprintDbId).toBe("agent-blueprint-db");
    expect(notionConfig.valueMetricsDbId).toBe("value-metrics-db");
  });
});
```

- [ ] **Step 6: Run the config test to verify it passes**

Run: `npx vitest run lib/notion/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/setup-notion.ts lib/notion/config.ts lib/notion/config.test.ts
git commit -m "feat: add Value Metrics database to Notion setup script"
```

- [ ] **Step 8: Note for the controller — live setup deferred**

This task's Step 1 code cannot be run live in a sandboxed implementer session (no real `NOTION_TOKEN`/`NOTION_PARENT_PAGE_ID`). After this task is reviewed, the controller (or the user) must run `npm run setup:notion` again against the real workspace (the script is idempotent — reruns reuse existing databases and only create what's missing), then add the newly printed `NOTION_VALUE_METRICS_DB_ID` to `.env.local`. This does not block Tasks 2-8's implementation or their mocked tests, only the final manual end-to-end verification.

---

### Task 2: Metric progress calculation logic

**Files:**
- Modify: `lib/scoring.ts`
- Modify: `lib/scoring.test.ts`

**Interfaces:**
- Produces: `interface MetricProgressInputs { baseline: number; current: number; target: number }`, `computeMetricProgress(metric: MetricProgressInputs): number` (returns a percentage 0-100) from `lib/scoring.ts`, consumed by Task 6 (`MetricCards.tsx`).

- [ ] **Step 1: Write the failing tests**

Add these test cases to `lib/scoring.test.ts`, appending after the existing `classifySuitability` describe block (keep every existing import and test in the file exactly as-is; add the new import and describe block):

Add `computeMetricProgress` to the existing import line:

```ts
import {
  computeBaselineSummary,
  computeSuitabilityScore,
  classifySuitability,
  computeMetricProgress,
} from "./scoring";
```

Append this describe block at the end of the file:

```ts
describe("computeMetricProgress", () => {
  it("computes progress toward a target that is lower than baseline (e.g. cost reduction)", () => {
    const progress = computeMetricProgress({ baseline: 100, current: 75, target: 50 });
    expect(progress).toBe(50);
  });

  it("computes progress toward a target that is higher than baseline (e.g. hours reallocated)", () => {
    const progress = computeMetricProgress({ baseline: 10, current: 15, target: 20 });
    expect(progress).toBe(50);
  });

  it("clamps progress at 100 when current has overshot the target", () => {
    const progress = computeMetricProgress({ baseline: 100, current: 40, target: 50 });
    expect(progress).toBe(100);
  });

  it("clamps progress at 0 when current has moved the wrong way from baseline", () => {
    const progress = computeMetricProgress({ baseline: 100, current: 110, target: 50 });
    expect(progress).toBe(0);
  });

  it("returns 0 when target equals baseline, avoiding a divide-by-zero", () => {
    const progress = computeMetricProgress({ baseline: 50, current: 60, target: 50 });
    expect(progress).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/scoring.test.ts`
Expected: FAIL — `computeMetricProgress` is not exported.

- [ ] **Step 3: Implement the addition in `lib/scoring.ts`**

Append this to the end of the file (keep every existing export exactly as-is):

```ts
export interface MetricProgressInputs {
  baseline: number;
  current: number;
  target: number;
}

export function computeMetricProgress(metric: MetricProgressInputs): number {
  if (metric.target === metric.baseline) return 0;
  const progress = (metric.current - metric.baseline) / (metric.target - metric.baseline);
  return Math.max(0, Math.min(1, progress)) * 100;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/scoring.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "feat: add metric progress calculation logic"
```

---

### Task 3: Value Metrics data access

**Files:**
- Create: `lib/notion/metrics.ts`
- Create: `lib/notion/metrics.test.ts`

**Interfaces:**
- Consumes: `getNotionClient()` (`lib/notion/client.ts`), `notionConfig.valueMetricsDbId` (Task 1).
- Produces: `interface MetricRecord { id: string; processId: string; metricName: string; category: string; baseline: number; current: number; target: number; unit: string }`, `listMetricsForProcess(processId: string): Promise<MetricRecord[]>`, `createMetric(input: { processId: string; metricName: string; category: string; baseline: number; current: number; target: number; unit: string }): Promise<MetricRecord>` — consumed by Task 4 (API route), Task 5/6/7 (components), and Task 8 (Phase 4 page).

- [ ] **Step 1: Write the failing tests**

Create `lib/notion/metrics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listMetricsForProcess, createMetric } from "./metrics";

const queryMock = vi.fn();
const createMock = vi.fn();

vi.mock("./client", () => ({
  getNotionClient: () => ({
    databases: { query: queryMock },
    pages: { create: createMock },
  }),
}));

vi.mock("./config", () => ({
  notionConfig: { valueMetricsDbId: "value-metrics-db-id" },
}));

function makeMetricPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "metric-1",
    properties: {
      "Metric Name": { title: [{ plain_text: "Requisition Cycle Time" }] },
      Process: { relation: [{ id: "process-1" }] },
      Category: { select: { name: "Cycle Time" } },
      Baseline: { number: 100 },
      Current: { number: 75 },
      Target: { number: 50 },
      Unit: { rich_text: [{ plain_text: "hrs" }] },
      ...overrides,
    },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  createMock.mockReset();
});

describe("listMetricsForProcess", () => {
  it("queries metrics filtered by process and maps results", async () => {
    queryMock.mockResolvedValue({ results: [makeMetricPage()] });
    const result = await listMetricsForProcess("process-1");
    expect(result).toEqual([
      {
        id: "metric-1",
        processId: "process-1",
        metricName: "Requisition Cycle Time",
        category: "Cycle Time",
        baseline: 100,
        current: 75,
        target: 50,
        unit: "hrs",
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith({
      database_id: "value-metrics-db-id",
      filter: { property: "Process", relation: { contains: "process-1" } },
    });
  });
});

describe("createMetric", () => {
  it("creates a metric page with all fields", async () => {
    createMock.mockResolvedValue(makeMetricPage());
    const result = await createMetric({
      processId: "process-1",
      metricName: "Requisition Cycle Time",
      category: "Cycle Time",
      baseline: 100,
      current: 75,
      target: 50,
      unit: "hrs",
    });
    expect(result.metricName).toBe("Requisition Cycle Time");
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "value-metrics-db-id" },
      properties: {
        "Metric Name": { title: [{ text: { content: "Requisition Cycle Time" } }] },
        Process: { relation: [{ id: "process-1" }] },
        Category: { select: { name: "Cycle Time" } },
        Baseline: { number: 100 },
        Current: { number: 75 },
        Target: { number: 50 },
        Unit: { rich_text: [{ text: { content: "hrs" } }] },
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/notion/metrics.test.ts`
Expected: FAIL — `Cannot find module './metrics'`.

- [ ] **Step 3: Implement `lib/notion/metrics.ts`**

```ts
import { getNotionClient } from "./client";
import { notionConfig } from "./config";

export interface MetricRecord {
  id: string;
  processId: string;
  metricName: string;
  category: string;
  baseline: number;
  current: number;
  target: number;
  unit: string;
}

function pageToMetric(page: any): MetricRecord {
  const props = page.properties;
  return {
    id: page.id,
    processId: props.Process?.relation?.[0]?.id ?? "",
    metricName: props["Metric Name"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
    category: props.Category?.select?.name ?? "Cycle Time",
    baseline: props.Baseline?.number ?? 0,
    current: props.Current?.number ?? 0,
    target: props.Target?.number ?? 0,
    unit: props.Unit?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
  };
}

export async function listMetricsForProcess(processId: string): Promise<MetricRecord[]> {
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: notionConfig.valueMetricsDbId,
    filter: { property: "Process", relation: { contains: processId } },
  });
  return response.results.map(pageToMetric);
}

export async function createMetric(input: {
  processId: string;
  metricName: string;
  category: string;
  baseline: number;
  current: number;
  target: number;
  unit: string;
}): Promise<MetricRecord> {
  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: { database_id: notionConfig.valueMetricsDbId },
    properties: {
      "Metric Name": { title: [{ text: { content: input.metricName } }] },
      Process: { relation: [{ id: input.processId }] },
      Category: { select: { name: input.category } },
      Baseline: { number: input.baseline },
      Current: { number: input.current },
      Target: { number: input.target },
      Unit: { rich_text: [{ text: { content: input.unit } }] },
    },
  });
  return pageToMetric(page);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/notion/metrics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notion/metrics.ts lib/notion/metrics.test.ts
git commit -m "feat: add Notion-backed Value Metrics data access"
```

---

### Task 4: Metrics API route

**Files:**
- Create: `app/api/metrics/route.ts`

**Interfaces:**
- Consumes: `listMetricsForProcess`, `createMetric` (Task 3).
- Produces: `GET /api/metrics?processId=` (200 with metrics array, or error), `POST /api/metrics` (201 with the created metric, or error).

- [ ] **Step 1: Implement `app/api/metrics/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createMetric, listMetricsForProcess } from "@/lib/notion/metrics";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");
  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  try {
    const metrics = await listMetricsForProcess(processId);
    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    !body.processId ||
    !body.metricName ||
    !body.category ||
    typeof body.baseline !== "number" ||
    typeof body.current !== "number" ||
    typeof body.target !== "number"
  ) {
    return NextResponse.json(
      {
        error:
          "processId, metricName, category, baseline, current, and target are required",
      },
      { status: 400 }
    );
  }
  try {
    const metric = await createMetric({
      processId: body.processId,
      metricName: body.metricName,
      category: body.category,
      baseline: body.baseline,
      current: body.current,
      target: body.target,
      unit: body.unit ?? "",
    });
    return NextResponse.json(metric, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add metric" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors. (Route logic is a thin wrapper over already-tested `lib/notion/metrics.ts` functions — covered end-to-end manually in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add app/api/metrics/route.ts
git commit -m "feat: add Value Metrics API route"
```

---

### Task 5: Metrics comparison chart

**Files:**
- Create: `components/MetricsChart.tsx`

**Interfaces:**
- Consumes: `MetricRecord` (Task 3).
- Produces: `MetricsChart({ metrics }: { metrics: MetricRecord[] })` component, consumed by Task 8. This is a client component (Recharts requires it) — keep the `"use client"` directive, same as `SuitabilityChart.tsx` from Plan 2.

- [ ] **Step 1: Implement `components/MetricsChart.tsx`**

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MetricRecord } from "@/lib/notion/metrics";

export function MetricsChart({ metrics }: { metrics: MetricRecord[] }) {
  if (metrics.length === 0) {
    return (
      <p className="mb-6 text-sm text-slate-500">
        Add a metric below to see the value-realization chart.
      </p>
    );
  }

  const data = metrics.map((metric) => ({
    name: metric.metricName,
    Baseline: metric.baseline,
    Current: metric.current,
    Target: metric.target,
  }));

  return (
    <div className="mb-6 h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Baseline" fill="#94a3b8" />
          <Bar dataKey="Current" fill="#2563eb" />
          <Bar dataKey="Target" fill="#16a34a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add components/MetricsChart.tsx
git commit -m "feat: add value metrics comparison chart"
```

---

### Task 6: KPI cards

**Files:**
- Create: `components/MetricCards.tsx`

**Interfaces:**
- Consumes: `MetricRecord` (Task 3), `computeMetricProgress` (Task 2).
- Produces: `MetricCards({ metrics }: { metrics: MetricRecord[] })` component, consumed by Task 8. This is a plain presentational component with no hooks — do NOT add a `"use client"` directive; it renders fine as a Server Component, same as `BaselineSummary.tsx` from Plan 1 and `AgentFlowDiagram.tsx` from Plan 3.

- [ ] **Step 1: Implement `components/MetricCards.tsx`**

```tsx
import { computeMetricProgress } from "@/lib/scoring";
import type { MetricRecord } from "@/lib/notion/metrics";

export function MetricCards({ metrics }: { metrics: MetricRecord[] }) {
  if (metrics.length === 0) {
    return (
      <p className="mb-6 text-sm text-slate-500">
        No value metrics yet. Add one below to start tracking impact.
      </p>
    );
  }

  return (
    <div className="mb-6 grid grid-cols-2 gap-4">
      {metrics.map((metric) => {
        const progress = computeMetricProgress(metric);
        return (
          <div key={metric.id} className="rounded border border-slate-200 p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-medium">{metric.metricName}</p>
              <span className="text-xs text-slate-500">{metric.category}</span>
            </div>
            <p className="mb-2 text-sm text-slate-500">
              {metric.baseline} {metric.unit} &rarr; {metric.current} {metric.unit}{" "}
              (target {metric.target} {metric.unit})
            </p>
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-slate-900"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">{progress.toFixed(0)}% of target</p>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add components/MetricCards.tsx
git commit -m "feat: add value metrics KPI cards"
```

---

### Task 7: Metric form

**Files:**
- Create: `components/MetricForm.tsx`

**Interfaces:**
- Consumes: `POST /api/metrics` (Task 4).
- Produces: `MetricForm({ processId }: { processId: string })` component, consumed by Task 8.

- [ ] **Step 1: Implement `components/MetricForm.tsx`**

```tsx
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
        className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {submitting ? "Adding..." : "Add Metric"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add components/MetricForm.tsx
git commit -m "feat: add value metric form"
```

---

### Task 8: Phase 4 page

**Files:**
- Create: `app/process/[id]/phase4/page.tsx`

**Interfaces:**
- Consumes: `PhaseTabs` (`components/PhaseTabs.tsx`), `MetricsChart` (Task 5), `MetricCards` (Task 6), `MetricForm` (Task 7), `listMetricsForProcess` (Task 3).
- Produces: fully working Phase 4 tab at `/process/[id]/phase4`.

- [ ] **Step 1: Implement `app/process/[id]/phase4/page.tsx`**

```tsx
import { PhaseTabs } from "@/components/PhaseTabs";
import { MetricsChart } from "@/components/MetricsChart";
import { MetricCards } from "@/components/MetricCards";
import { MetricForm } from "@/components/MetricForm";
import { listMetricsForProcess, type MetricRecord } from "@/lib/notion/metrics";

export const revalidate = 10;

export default async function Phase4Page({ params }: { params: { id: string } }) {
  let metrics: MetricRecord[] = [];
  let error: string | null = null;
  try {
    metrics = await listMetricsForProcess(params.id);
  } catch {
    error = "Failed to load value metrics. Please try again.";
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <PhaseTabs processId={params.id} activePhase={4} />
      <h2 className="mb-4 text-lg font-semibold">
        Value Realization and Business Impact Measurement
      </h2>
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </p>
      ) : (
        <>
          <MetricCards metrics={metrics} />
          <MetricsChart metrics={metrics} />
          <MetricForm processId={params.id} />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (client, config, processes, steps, scoring, suitability, orchestration, agents, metrics).

- [ ] **Step 3: Manually verify the full end-to-end flow (controller/user, once `NOTION_VALUE_METRICS_DB_ID` is live — see Task 1 Step 8)**

1. Open an existing process.
2. Click the "Phase 4: Value" tab.
3. Confirm the empty-state messages show (cards: "No value metrics yet..."; chart: "Add a metric below...").
4. Add a metric, e.g. "Requisition Cycle Time", Category "Cycle Time", Baseline 100, Current 75, Target 50, Unit "hrs".
5. Confirm a KPI card appears showing "100 hrs → 75 hrs (target 50 hrs)" with a progress bar at 50% ("50% of target").
6. Confirm the bar chart now shows one group of three bars (Baseline/Current/Target) for this metric.
7. Add a second metric with an "increase is good" shape, e.g. "Hours Reallocated to Strategy", Category "Human Hours Reallocated", Baseline 10, Current 15, Target 20, Unit "hrs/week". Confirm its progress bar also shows 50% (proving the formula handles both directions correctly) and a second bar group appears on the chart.
8. Reload the page — confirm both metrics, their cards, and the chart persist.

Expected: all values match manual entry; no console errors; chart renders without crashing.

- [ ] **Step 4: Commit**

```bash
git add "app/process/[id]/phase4/page.tsx"
git commit -m "feat: add Phase 4 value realization UI"
```
