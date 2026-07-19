# Phase 2 (Agentic Feasibility Analysis) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Phase 2 to the app: score each process step on Data Complexity, Decision Logic, and Context Volatility, auto-classify it (Algorithmic / Agentic / Human-required), and visualize the whole process as a suitability scatter chart.

**Architecture:** Same as Plan 1 (Foundation + Phase 1) — Notion as the sole data store, Server Components for reads with inline error banners on failure, Route Handlers for writes with try/catch guaranteeing a JSON body on every path, client components only where interactivity is needed.

**Tech Stack:** Same as Plan 1 (Next.js 14, TypeScript, Tailwind, `@notionhq/client`, Vitest), plus `recharts` for the Phase 2 scatter chart.

## Global Constraints

- Data store is Notion only — no separate database (spec: Architecture).
- Notion integration token lives server-side only, via `NOTION_TOKEN` env var, never sent to the client (spec: Architecture, Non-goals).
- No user login/auth in v1 (spec: Non-goals).
- Reads use Server Components with short revalidation caching; writes go through Route Handlers directly to Notion (spec: Architecture).
- Notion API failures surface as an inline error banner on the affected screen; the rest of the UI stays usable (spec: Error Handling) — apply this from the start in every Server Component and API route this plan adds (Plan 1 needed a follow-up fix for this; this plan bakes it in from Task 1 onward).
- Suitability Score = `decisionLogic * 0.5 + dataComplexity * 0.25 + contextVolatility * 0.25` (decided with the user for this plan).
- Classification thresholds: score < 2.33 → "Algorithmic"; 2.33 ≤ score ≤ 3.67 → "Agentic"; score > 3.67 → "Human-required" (decided with the user for this plan).
- Chart library: `recharts` (decided with the user for this plan).

---

### Task 1: Extend Notion schema and config for Suitability Scores

**Files:**
- Modify: `scripts/setup-notion.ts`
- Modify: `lib/notion/config.ts`
- Modify: `lib/notion/config.test.ts`

**Interfaces:**
- Consumes: the existing `stepsDb.id` already created earlier in `scripts/setup-notion.ts`.
- Produces: a live Notion "Suitability Scores" database (one-way relation to Process Steps) once run manually; `notionConfig.suitabilityDbId` getter (throws `"NOTION_SUITABILITY_DB_ID environment variable is not set"` if unset), consumed by Task 3 onward.

- [ ] **Step 1: Add Suitability Scores database creation to `scripts/setup-notion.ts`**

Replace the full file with:

```ts
import { Client } from "@notionhq/client";

async function main() {
  const token = process.env.NOTION_TOKEN;
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;
  if (!token) throw new Error("NOTION_TOKEN environment variable is not set");
  if (!parentPageId) {
    throw new Error("NOTION_PARENT_PAGE_ID environment variable is not set");
  }

  const notion = new Client({ auth: token });

  const processesDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Processes" } }],
    properties: {
      Name: { title: {} },
      Description: { rich_text: {} },
      Owner: { rich_text: {} },
      Status: {
        select: {
          options: [
            { name: "Not Started", color: "gray" },
            { name: "In Progress", color: "yellow" },
            { name: "Complete", color: "green" },
          ],
        },
      },
      "Current Phase": {
        select: {
          options: [
            { name: "1", color: "blue" },
            { name: "2", color: "blue" },
            { name: "3", color: "blue" },
            { name: "4", color: "blue" },
          ],
        },
      },
    },
  });

  const stepsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Process Steps" } }],
    properties: {
      "Step Name": { title: {} },
      Process: {
        relation: {
          database_id: processesDb.id,
          type: "dual_property",
          dual_property: {},
        },
      },
      Sequence: { number: { format: "number" } },
      "Handoff Type": {
        select: {
          options: [
            { name: "System", color: "blue" },
            { name: "Human", color: "orange" },
            { name: "Cross-team", color: "purple" },
            { name: "External", color: "red" },
          ],
        },
      },
      "Cycle Time (hrs)": { number: { format: "number" } },
      Cost: { number: { format: "number" } },
      Bottleneck: { checkbox: {} },
      Notes: { rich_text: {} },
    },
  });

  const processesDbFull = await notion.databases.retrieve({
    database_id: processesDb.id,
  });
  const backRelation = Object.values(processesDbFull.properties).find(
    (prop: any) => prop.type === "relation"
  ) as any;
  if (!backRelation) {
    throw new Error("Could not find the auto-created relation property on Processes");
  }

  await notion.databases.update({
    database_id: processesDb.id,
    properties: {
      [backRelation.name]: { name: "Steps" },
      "Total Cycle Time (hrs)": {
        rollup: {
          relation_property_name: "Steps",
          rollup_property_name: "Cycle Time (hrs)",
          function: "sum",
        },
      },
      "Total Cost": {
        rollup: {
          relation_property_name: "Steps",
          rollup_property_name: "Cost",
          function: "sum",
        },
      },
      "Bottleneck Count": {
        rollup: {
          relation_property_name: "Steps",
          rollup_property_name: "Bottleneck",
          function: "checked",
        },
      },
    },
  });

  const suitabilityDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Suitability Scores" } }],
    properties: {
      Score: { title: {} },
      Step: {
        relation: {
          database_id: stepsDb.id,
          type: "single_property",
          single_property: {},
        },
      },
      "Data Complexity": { number: { format: "number" } },
      "Decision Logic": { number: { format: "number" } },
      "Context Volatility": { number: { format: "number" } },
      "Suitability Score": { number: { format: "number" } },
      Classification: {
        select: {
          options: [
            { name: "Algorithmic", color: "blue" },
            { name: "Agentic", color: "green" },
            { name: "Human-required", color: "orange" },
          ],
        },
      },
    },
  });

  console.log("Notion setup complete. Add these to your .env.local:\n");
  console.log(`NOTION_PROCESSES_DB_ID=${processesDb.id}`);
  console.log(`NOTION_STEPS_DB_ID=${stepsDb.id}`);
  console.log(`NOTION_SUITABILITY_DB_ID=${suitabilityDb.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the script still type-checks**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Add `suitabilityDbId` to `lib/notion/config.ts`**

Replace the full file with:

```ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export const notionConfig = {
  get parentPageId() {
    return requireEnv("NOTION_PARENT_PAGE_ID");
  },
  get processesDbId() {
    return requireEnv("NOTION_PROCESSES_DB_ID");
  },
  get stepsDbId() {
    return requireEnv("NOTION_STEPS_DB_ID");
  },
  get suitabilityDbId() {
    return requireEnv("NOTION_SUITABILITY_DB_ID");
  },
};
```

- [ ] **Step 4: Add a test for `suitabilityDbId` to `lib/notion/config.test.ts`**

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

  it("exposes processesDbId, stepsDbId, and suitabilityDbId the same way", () => {
    process.env.NOTION_PROCESSES_DB_ID = "processes-db";
    process.env.NOTION_STEPS_DB_ID = "steps-db";
    process.env.NOTION_SUITABILITY_DB_ID = "suitability-db";
    expect(notionConfig.processesDbId).toBe("processes-db");
    expect(notionConfig.stepsDbId).toBe("steps-db");
    expect(notionConfig.suitabilityDbId).toBe("suitability-db");
  });
});
```

- [ ] **Step 5: Run the config test to verify it passes**

Run: `npx vitest run lib/notion/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/setup-notion.ts lib/notion/config.ts lib/notion/config.test.ts
git commit -m "feat: add Suitability Scores database to Notion setup script"
```

- [ ] **Step 7: Note for the controller — live setup deferred**

This task's Step 1 code cannot be run live in a sandboxed implementer session (no real `NOTION_TOKEN`/`NOTION_PARENT_PAGE_ID`). After this task is reviewed, the controller (or the user) must run `npm run setup:notion` again against the real workspace, then add the newly printed `NOTION_SUITABILITY_DB_ID` to `.env.local`. This does not block Tasks 2–7's implementation or their mocked tests, only the final manual end-to-end verification.

---

### Task 2: Suitability scoring logic

**Files:**
- Modify: `lib/scoring.ts`
- Modify: `lib/scoring.test.ts`

**Interfaces:**
- Produces: `interface SuitabilityInputs { dataComplexity: number; decisionLogic: number; contextVolatility: number }`, `computeSuitabilityScore(inputs: SuitabilityInputs): number`, `type SuitabilityClassification = "Algorithmic" | "Agentic" | "Human-required"`, `classifySuitability(score: number): SuitabilityClassification` — both from `lib/scoring.ts`, consumed by Task 3 (`suitability.ts`) and Task 6 (`SuitabilityForm.tsx`).

- [ ] **Step 1: Write the failing tests**

Replace the full file `lib/scoring.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import {
  computeBaselineSummary,
  computeSuitabilityScore,
  classifySuitability,
} from "./scoring";
import type { StepRecord } from "./notion/steps";

function makeStep(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    id: "s1",
    processId: "p1",
    stepName: "Step",
    sequence: 1,
    handoffType: "System",
    cycleTimeHours: 0,
    cost: 0,
    bottleneck: false,
    notes: "",
    ...overrides,
  };
}

describe("computeBaselineSummary", () => {
  it("returns zeros for an empty step list", () => {
    expect(computeBaselineSummary([])).toEqual({
      totalCycleTimeHours: 0,
      totalCost: 0,
      bottleneckCount: 0,
    });
  });

  it("sums cycle time and cost, and counts bottlenecks", () => {
    const steps = [
      makeStep({ cycleTimeHours: 4, cost: 100, bottleneck: true }),
      makeStep({ cycleTimeHours: 2.5, cost: 50, bottleneck: false }),
      makeStep({ cycleTimeHours: 1, cost: 25, bottleneck: true }),
    ];
    expect(computeBaselineSummary(steps)).toEqual({
      totalCycleTimeHours: 7.5,
      totalCost: 175,
      bottleneckCount: 2,
    });
  });
});

describe("computeSuitabilityScore", () => {
  it("weights decision logic at 0.5 and the other two inputs at 0.25 each", () => {
    const score = computeSuitabilityScore({
      dataComplexity: 1,
      decisionLogic: 5,
      contextVolatility: 3,
    });
    expect(score).toBe(3.5);
  });

  it("weights all-equal inputs to the same value", () => {
    const score = computeSuitabilityScore({
      dataComplexity: 4,
      decisionLogic: 4,
      contextVolatility: 4,
    });
    expect(score).toBe(4);
  });
});

describe("classifySuitability", () => {
  it("classifies scores below 2.33 as Algorithmic", () => {
    expect(classifySuitability(1)).toBe("Algorithmic");
    expect(classifySuitability(2.32)).toBe("Algorithmic");
  });

  it("classifies scores from 2.33 to 3.67 inclusive as Agentic", () => {
    expect(classifySuitability(2.33)).toBe("Agentic");
    expect(classifySuitability(3)).toBe("Agentic");
    expect(classifySuitability(3.67)).toBe("Agentic");
  });

  it("classifies scores above 3.67 as Human-required", () => {
    expect(classifySuitability(3.68)).toBe("Human-required");
    expect(classifySuitability(5)).toBe("Human-required");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/scoring.test.ts`
Expected: FAIL — `computeSuitabilityScore`/`classifySuitability` are not exported.

- [ ] **Step 3: Implement the additions in `lib/scoring.ts`**

Replace the full file with:

```ts
import type { StepRecord } from "./notion/steps";

export interface BaselineSummary {
  totalCycleTimeHours: number;
  totalCost: number;
  bottleneckCount: number;
}

export function computeBaselineSummary(steps: StepRecord[]): BaselineSummary {
  return steps.reduce(
    (summary, step) => ({
      totalCycleTimeHours: summary.totalCycleTimeHours + step.cycleTimeHours,
      totalCost: summary.totalCost + step.cost,
      bottleneckCount: summary.bottleneckCount + (step.bottleneck ? 1 : 0),
    }),
    { totalCycleTimeHours: 0, totalCost: 0, bottleneckCount: 0 }
  );
}

export interface SuitabilityInputs {
  dataComplexity: number;
  decisionLogic: number;
  contextVolatility: number;
}

export function computeSuitabilityScore(inputs: SuitabilityInputs): number {
  return (
    inputs.decisionLogic * 0.5 +
    inputs.dataComplexity * 0.25 +
    inputs.contextVolatility * 0.25
  );
}

export type SuitabilityClassification = "Algorithmic" | "Agentic" | "Human-required";

export function classifySuitability(score: number): SuitabilityClassification {
  if (score < 2.33) return "Algorithmic";
  if (score <= 3.67) return "Agentic";
  return "Human-required";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/scoring.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "feat: add suitability score and classification logic"
```

---

### Task 3: Suitability Scores data access

**Files:**
- Create: `lib/notion/suitability.ts`
- Create: `lib/notion/suitability.test.ts`

**Interfaces:**
- Consumes: `getNotionClient()` (`lib/notion/client.ts`), `notionConfig.suitabilityDbId` (Task 1), `computeSuitabilityScore`/`classifySuitability` (Task 2).
- Produces: `interface SuitabilityScoreRecord { id: string; stepId: string; dataComplexity: number; decisionLogic: number; contextVolatility: number; suitabilityScore: number; classification: string }`, `listSuitabilityScoresForSteps(stepIds: string[]): Promise<SuitabilityScoreRecord[]>`, `upsertSuitabilityScore(input: { stepId: string; dataComplexity: number; decisionLogic: number; contextVolatility: number }): Promise<SuitabilityScoreRecord>` — consumed by Task 4 (API route) and Task 7 (Phase 2 page).

- [ ] **Step 1: Write the failing tests**

Create `lib/notion/suitability.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listSuitabilityScoresForSteps, upsertSuitabilityScore } from "./suitability";

const queryMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock("./client", () => ({
  getNotionClient: () => ({
    databases: { query: queryMock },
    pages: { create: createMock, update: updateMock },
  }),
}));

vi.mock("./config", () => ({
  notionConfig: { suitabilityDbId: "suitability-db-id" },
}));

function makeScorePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "score-1",
    properties: {
      Score: { title: [{ plain_text: "Score" }] },
      Step: { relation: [{ id: "step-1" }] },
      "Data Complexity": { number: 2 },
      "Decision Logic": { number: 4 },
      "Context Volatility": { number: 2 },
      "Suitability Score": { number: 3 },
      Classification: { select: { name: "Agentic" } },
      ...overrides,
    },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
});

describe("listSuitabilityScoresForSteps", () => {
  it("returns an empty array without querying Notion when given no step ids", async () => {
    const result = await listSuitabilityScoresForSteps([]);
    expect(result).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("queries with an OR filter across all step ids and maps results", async () => {
    queryMock.mockResolvedValue({ results: [makeScorePage()] });
    const result = await listSuitabilityScoresForSteps(["step-1", "step-2"]);
    expect(result).toEqual([
      {
        id: "score-1",
        stepId: "step-1",
        dataComplexity: 2,
        decisionLogic: 4,
        contextVolatility: 2,
        suitabilityScore: 3,
        classification: "Agentic",
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith({
      database_id: "suitability-db-id",
      filter: {
        or: [
          { property: "Step", relation: { contains: "step-1" } },
          { property: "Step", relation: { contains: "step-2" } },
        ],
      },
    });
  });
});

describe("upsertSuitabilityScore", () => {
  it("creates a new score page when none exists for the step", async () => {
    queryMock.mockResolvedValue({ results: [] });
    createMock.mockResolvedValue(makeScorePage());
    const result = await upsertSuitabilityScore({
      stepId: "step-1",
      dataComplexity: 2,
      decisionLogic: 4,
      contextVolatility: 2,
    });
    expect(result.suitabilityScore).toBe(3);
    expect(result.classification).toBe("Agentic");
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "suitability-db-id" },
      properties: {
        Score: { title: [{ text: { content: "Score" } }] },
        Step: { relation: [{ id: "step-1" }] },
        "Data Complexity": { number: 2 },
        "Decision Logic": { number: 4 },
        "Context Volatility": { number: 2 },
        "Suitability Score": { number: 3 },
        Classification: { select: { name: "Agentic" } },
      },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates the existing score page when one already exists for the step", async () => {
    queryMock.mockResolvedValue({ results: [makeScorePage()] });
    updateMock.mockResolvedValue(
      makeScorePage({
        "Data Complexity": { number: 5 },
        "Suitability Score": { number: 3.75 },
        Classification: { select: { name: "Human-required" } },
      })
    );
    const result = await upsertSuitabilityScore({
      stepId: "step-1",
      dataComplexity: 5,
      decisionLogic: 4,
      contextVolatility: 2,
    });
    expect(result.dataComplexity).toBe(5);
    expect(updateMock).toHaveBeenCalledWith({
      page_id: "score-1",
      properties: {
        "Data Complexity": { number: 5 },
        "Decision Logic": { number: 4 },
        "Context Volatility": { number: 2 },
        "Suitability Score": { number: 3.75 },
        Classification: { select: { name: "Human-required" } },
      },
    });
    expect(createMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/notion/suitability.test.ts`
Expected: FAIL — `Cannot find module './suitability'`.

- [ ] **Step 3: Implement `lib/notion/suitability.ts`**

```ts
import { getNotionClient } from "./client";
import { notionConfig } from "./config";
import { computeSuitabilityScore, classifySuitability } from "../scoring";

export interface SuitabilityScoreRecord {
  id: string;
  stepId: string;
  dataComplexity: number;
  decisionLogic: number;
  contextVolatility: number;
  suitabilityScore: number;
  classification: string;
}

function pageToSuitabilityScore(page: any): SuitabilityScoreRecord {
  const props = page.properties;
  return {
    id: page.id,
    stepId: props.Step?.relation?.[0]?.id ?? "",
    dataComplexity: props["Data Complexity"]?.number ?? 0,
    decisionLogic: props["Decision Logic"]?.number ?? 0,
    contextVolatility: props["Context Volatility"]?.number ?? 0,
    suitabilityScore: props["Suitability Score"]?.number ?? 0,
    classification: props.Classification?.select?.name ?? "Algorithmic",
  };
}

export async function listSuitabilityScoresForSteps(
  stepIds: string[]
): Promise<SuitabilityScoreRecord[]> {
  if (stepIds.length === 0) return [];
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: notionConfig.suitabilityDbId,
    filter: {
      or: stepIds.map((id) => ({
        property: "Step",
        relation: { contains: id },
      })),
    },
  });
  return response.results.map(pageToSuitabilityScore);
}

export async function upsertSuitabilityScore(input: {
  stepId: string;
  dataComplexity: number;
  decisionLogic: number;
  contextVolatility: number;
}): Promise<SuitabilityScoreRecord> {
  const notion = getNotionClient();
  const suitabilityScore = computeSuitabilityScore(input);
  const classification = classifySuitability(suitabilityScore);
  const properties = {
    "Data Complexity": { number: input.dataComplexity },
    "Decision Logic": { number: input.decisionLogic },
    "Context Volatility": { number: input.contextVolatility },
    "Suitability Score": { number: suitabilityScore },
    Classification: { select: { name: classification } },
  };

  const existing = await notion.databases.query({
    database_id: notionConfig.suitabilityDbId,
    filter: { property: "Step", relation: { contains: input.stepId } },
  });

  if (existing.results.length > 0) {
    const page = await notion.pages.update({
      page_id: existing.results[0].id,
      properties,
    });
    return pageToSuitabilityScore(page);
  }

  const page = await notion.pages.create({
    parent: { database_id: notionConfig.suitabilityDbId },
    properties: {
      Score: { title: [{ text: { content: "Score" } }] },
      Step: { relation: [{ id: input.stepId }] },
      ...properties,
    },
  });
  return pageToSuitabilityScore(page);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/notion/suitability.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notion/suitability.ts lib/notion/suitability.test.ts
git commit -m "feat: add Notion-backed Suitability Scores data access"
```

---

### Task 4: Suitability API route

**Files:**
- Create: `app/api/suitability/route.ts`

**Interfaces:**
- Consumes: `listStepsForProcess` (`lib/notion/steps.ts`), `listSuitabilityScoresForSteps`, `upsertSuitabilityScore` (Task 3).
- Produces: `GET /api/suitability?processId=` (200 with scores array, or error), `POST /api/suitability` (200 with the upserted score, or error).

- [ ] **Step 1: Implement `app/api/suitability/route.ts`**

```ts
import { NextResponse } from "next/server";
import { listStepsForProcess } from "@/lib/notion/steps";
import {
  listSuitabilityScoresForSteps,
  upsertSuitabilityScore,
} from "@/lib/notion/suitability";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");
  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  try {
    const steps = await listStepsForProcess(processId);
    const scores = await listSuitabilityScoresForSteps(steps.map((step) => step.id));
    return NextResponse.json(scores);
  } catch {
    return NextResponse.json(
      { error: "Failed to load suitability scores" },
      { status: 500 }
    );
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
    !body.stepId ||
    typeof body.dataComplexity !== "number" ||
    typeof body.decisionLogic !== "number" ||
    typeof body.contextVolatility !== "number"
  ) {
    return NextResponse.json(
      {
        error:
          "stepId, dataComplexity, decisionLogic, and contextVolatility are required",
      },
      { status: 400 }
    );
  }
  try {
    const score = await upsertSuitabilityScore({
      stepId: body.stepId,
      dataComplexity: body.dataComplexity,
      decisionLogic: body.decisionLogic,
      contextVolatility: body.contextVolatility,
    });
    return NextResponse.json(score, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to save suitability score" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors. (Route logic is a thin wrapper over already-tested `lib/notion/suitability.ts` and `lib/notion/steps.ts` functions — covered end-to-end manually in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add app/api/suitability/route.ts
git commit -m "feat: add Suitability Scores API route"
```

---

### Task 5: Suitability scatter chart

**Files:**
- Modify: `package.json` (add `recharts` dependency)
- Create: `components/SuitabilityChart.tsx`

**Interfaces:**
- Consumes: `StepRecord` (`lib/notion/steps.ts`), `SuitabilityScoreRecord` (Task 3).
- Produces: `SuitabilityChart({ steps, scores }: { steps: StepRecord[]; scores: SuitabilityScoreRecord[] })` component from `components/SuitabilityChart.tsx`, consumed by Task 7.

- [ ] **Step 1: Add `recharts` to `package.json`**

In `package.json`, find the `"dependencies"` object and replace its contents with the block below (this adds one new line, `"recharts": "^2.12.7"`, in alphabetical order — every other key in the file, including `devDependencies` and `scripts`, stays exactly as-is):

```json
  "dependencies": {
    "@notionhq/client": "^2.2.15",
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7"
  },
```

- [ ] **Step 2: Install the new dependency**

Run: `npm install`
Expected: exits 0, `recharts` added to `package-lock.json`.

- [ ] **Step 3: Implement `components/SuitabilityChart.tsx`**

```tsx
"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { StepRecord } from "@/lib/notion/steps";
import type { SuitabilityScoreRecord } from "@/lib/notion/suitability";

const CLASSIFICATION_COLORS: Record<string, string> = {
  Algorithmic: "#2563eb",
  Agentic: "#16a34a",
  "Human-required": "#ea580c",
};

export function SuitabilityChart({
  steps,
  scores,
}: {
  steps: StepRecord[];
  scores: SuitabilityScoreRecord[];
}) {
  const data = scores
    .map((score) => {
      const step = steps.find((s) => s.id === score.stepId);
      if (!step) return null;
      return {
        stepName: step.stepName,
        dataComplexity: score.dataComplexity,
        contextVolatility: score.contextVolatility,
        suitabilityScore: score.suitabilityScore,
        classification: score.classification,
      };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null);

  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Score at least one step below to see the suitability chart.
      </p>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="dataComplexity"
            name="Data Complexity"
            domain={[1, 5]}
            label={{ value: "Data Complexity", position: "insideBottom", offset: -10 }}
          />
          <YAxis
            type="number"
            dataKey="contextVolatility"
            name="Context Volatility"
            domain={[1, 5]}
            label={{ value: "Context Volatility", angle: -90, position: "insideLeft" }}
          />
          <ZAxis
            type="number"
            dataKey="suitabilityScore"
            range={[60, 400]}
            name="Suitability Score"
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(value: number, name: string) => [value, name]}
            labelFormatter={() => ""}
          />
          <Scatter data={data}>
            {data.map((point, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CLASSIFICATION_COLORS[point.classification] ?? "#64748b"}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/SuitabilityChart.tsx
git commit -m "feat: add suitability scatter chart"
```

---

### Task 6: Suitability scoring form

**Files:**
- Create: `components/SuitabilityForm.tsx`

**Interfaces:**
- Consumes: `StepRecord` (`lib/notion/steps.ts`), `SuitabilityScoreRecord` (Task 3), `computeSuitabilityScore`/`classifySuitability` (Task 2), `POST /api/suitability` (Task 4).
- Produces: `SuitabilityForm({ processId, steps, scores }: { processId: string; steps: StepRecord[]; scores: SuitabilityScoreRecord[] })` component, consumed by Task 7.

- [ ] **Step 1: Implement `components/SuitabilityForm.tsx`**

```tsx
"use client";

import { useState } from "react";
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
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateInput(stepId: string, field: keyof RowInputs, value: number) {
    setInputs((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], [field]: value },
    }));
  }

  async function handleSave(stepId: string) {
    setSavingStepId(stepId);
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
      setSavingStepId(null);
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
              <tr key={step.id} className="border-b border-slate-100">
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
                <td>
                  <button
                    type="button"
                    disabled={savingStepId === step.id}
                    onClick={() => handleSave(step.id)}
                    className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-50"
                  >
                    {savingStepId === step.id ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add components/SuitabilityForm.tsx
git commit -m "feat: add suitability scoring form"
```

---

### Task 7: Phase 2 page

**Files:**
- Create: `app/process/[id]/phase2/page.tsx`

**Interfaces:**
- Consumes: `PhaseTabs` (`components/PhaseTabs.tsx`), `SuitabilityChart` (Task 5), `SuitabilityForm` (Task 6), `listStepsForProcess` (`lib/notion/steps.ts`), `listSuitabilityScoresForSteps` (Task 3).
- Produces: fully working Phase 2 tab at `/process/[id]/phase2`.

- [ ] **Step 1: Implement `app/process/[id]/phase2/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (client, config, processes, steps, scoring, suitability).

- [ ] **Step 3: Manually verify the full end-to-end flow (controller/user, once `NOTION_SUITABILITY_DB_ID` is live — see Task 1 Step 7)**

1. Open an existing process (or create one and add steps in Phase 1).
2. Click the "Phase 2: Feasibility" tab.
3. Confirm each step appears as a row with default 3/3/3 inputs, a live-computed Score, and Classification.
4. Change a row's inputs (e.g. Decision Logic to 5) and confirm the Score/Classification preview updates immediately, client-side, before saving.
5. Click "Save" on that row — confirm it persists (reload the page, the saved values should still be there) and the scatter chart now shows a point for that step, colored by its classification.
6. Save a second step with different inputs, confirm a second distinct point appears on the chart.

Expected: all values match manual entry; no console errors; chart renders without crashing.

- [ ] **Step 4: Commit**

```bash
git add "app/process/[id]/phase2/page.tsx"
git commit -m "feat: add Phase 2 agentic feasibility UI"
```
