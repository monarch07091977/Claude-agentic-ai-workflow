# AI Assist Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three AI-assisted drafting features to the existing Notion-backed workflow app: suggest suitability scores (Phase 2), draft steps from pasted text (Phase 1), and draft an agent blueprint from scored steps (Phase 3).

**Architecture:** A single shared `lib/ai/client.ts` wraps the Anthropic SDK behind one `generateStructured<T>()` function that forces a tool-use call so responses come back as parseable JSON. Each feature gets its own pure prompt/schema module under `lib/ai/`, a thin API route that follows the project's existing try/catch-JSON-on-every-path convention, and a UI control that pre-fills the *existing* manual-entry form state — nothing new ever writes to Notion directly.

**Tech Stack:** Anthropic SDK (`@anthropic-ai/sdk`) added to the existing Next.js 14 / TypeScript / Tailwind / Notion stack. No other new dependencies.

## Global Constraints

- Provider/model: Anthropic Claude, model id `claude-sonnet-5`, called via the Messages API with a forced `tool_choice` so the response is a structured tool-use call, not free text to parse.
- New required env var: `ANTHROPIC_API_KEY`. Must be added to `.env.local.example`, all three README deploy sections (Vercel, Docker, Render — each currently says "seven environment variables", becomes eight), and `render.yaml`.
- **Hard product rule:** the model never writes to Notion. Every AI response only pre-fills editable client-side form state. Committing a record always goes through the existing manual-entry endpoint (`POST /api/steps`, `POST /api/agents`) — no new bulk-write endpoints.
- `@anthropic-ai/sdk` is imported only inside `lib/ai/client.ts`. No route file or component imports it directly.
- Every new API route returns a JSON body on every path (success, validation failure, caught exception) — the existing convention in every route under `app/api/`.
- Every new client-side mutating `fetch` uses try/catch/finally so errors are always visible and disabled/loading state always resets, on all three paths (success, non-ok response, network rejection) — the existing convention in every form component.
- No test hits the real Anthropic API. Mock `@anthropic-ai/sdk` at the module boundary in tests, the same way `@notionhq/client` is mocked today via `vi.mock("./client", ...)`.
- Primary-action buttons use `bg-brand-700 ... hover:bg-brand-900` (the established brand color scale), matching every existing button in the app.

---

### AI Task 1: Anthropic client and shared structured-generation helper

**Files:**
- Modify: `package.json` (add `@anthropic-ai/sdk` dependency)
- Create: `lib/ai/config.ts`
- Create: `lib/ai/config.test.ts`
- Create: `lib/ai/client.ts`
- Create: `lib/ai/client.test.ts`
- Modify: `.env.local.example`
- Modify: `README.md`
- Modify: `render.yaml`

**Interfaces:**
- Produces: `aiConfig.anthropicApiKey: string` (getter, throws if unset — same shape as `notionConfig` in `lib/notion/config.ts`)
- Produces: `generateStructured<T>(params: { system: string; prompt: string; schema: Record<string, unknown> }): Promise<T>` — every later task's route calls this.

- [ ] **Step 1: Install the Anthropic SDK**

Run: `npm install @anthropic-ai/sdk`

This resolves and pins the current published version in `package.json` / `package-lock.json` — do not hand-edit a version number.

- [ ] **Step 2: Write the failing config test**

Create `lib/ai/config.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { aiConfig } from "./config";

describe("aiConfig", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("throws when ANTHROPIC_API_KEY is not set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => aiConfig.anthropicApiKey).toThrow(
      "ANTHROPIC_API_KEY environment variable is not set"
    );
  });

  it("returns the value when set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(aiConfig.anthropicApiKey).toBe("sk-ant-test");
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run lib/ai/config.test.ts`
Expected: FAIL — `lib/ai/config.ts` does not exist yet.

- [ ] **Step 4: Implement the config module**

Create `lib/ai/config.ts`:

```ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export const aiConfig = {
  get anthropicApiKey() {
    return requireEnv("ANTHROPIC_API_KEY");
  },
};
```

- [ ] **Step 5: Run it to confirm it passes**

Run: `npx vitest run lib/ai/config.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Write the failing client test**

Create `lib/ai/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

vi.mock("./config", () => ({
  aiConfig: { anthropicApiKey: "test-key" },
}));

import { generateStructured } from "./client";

beforeEach(() => {
  createMock.mockReset();
});

describe("generateStructured", () => {
  it("returns the tool_use block's input", async () => {
    createMock.mockResolvedValue({
      content: [
        { type: "text", text: "thinking..." },
        { type: "tool_use", name: "respond", input: { foo: "bar" } },
      ],
    });
    const result = await generateStructured<{ foo: string }>({
      system: "You are a helpful assistant.",
      prompt: "Say something.",
      schema: { type: "object", properties: { foo: { type: "string" } } },
    });
    expect(result).toEqual({ foo: "bar" });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-5",
        system: "You are a helpful assistant.",
        messages: [{ role: "user", content: "Say something." }],
        tool_choice: { type: "tool", name: "respond" },
      })
    );
  });

  it("throws when the response has no tool_use block", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "no tool call" }] });
    await expect(
      generateStructured({ system: "s", prompt: "p", schema: {} })
    ).rejects.toThrow("Model response did not include a tool_use block");
  });
});
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `npx vitest run lib/ai/client.test.ts`
Expected: FAIL — `lib/ai/client.ts` does not exist yet.

- [ ] **Step 8: Implement the client module**

Create `lib/ai/client.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { aiConfig } from "./config";

const MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: aiConfig.anthropicApiKey });
  }
  return client;
}

export async function generateStructured<T>(params: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
    tools: [
      {
        name: "respond",
        description: "Provide the structured response for this request.",
        input_schema: params.schema as any,
      },
    ],
    tool_choice: { type: "tool", name: "respond" },
  });

  const toolUse = response.content.find(
    (block: any) => block.type === "tool_use"
  ) as any;
  if (!toolUse) {
    throw new Error("Model response did not include a tool_use block");
  }
  return toolUse.input as T;
}
```

- [ ] **Step 9: Run it to confirm it passes**

Run: `npx vitest run lib/ai/client.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 10: Add the env var to `.env.local.example`**

Append a line to `.env.local.example`:

```
ANTHROPIC_API_KEY=sk-ant-xxx
```

- [ ] **Step 11: Update README.md**

In the `## Setup` → `### 3. Configure environment variables` section, after the existing sentence about `NOTION_TOKEN`/`NOTION_PARENT_PAGE_ID`, add:

```markdown
Also fill in `ANTHROPIC_API_KEY` (from
[console.anthropic.com](https://console.anthropic.com/settings/keys)) — it powers the
AI-assisted drafting buttons in Phases 1, 2, and 3. The app works without it; those
buttons simply return an error until it's set.
```

In `### Option A: Vercel`, change:

```
2. Set the seven environment variables from `.env.local` (`NOTION_TOKEN`,
   `NOTION_PARENT_PAGE_ID`, `NOTION_PROCESSES_DB_ID`, `NOTION_STEPS_DB_ID`,
   `NOTION_SUITABILITY_DB_ID`, `NOTION_AGENT_BLUEPRINT_DB_ID`,
   `NOTION_VALUE_METRICS_DB_ID`) in the host's project settings.
```

to:

```
2. Set the eight environment variables from `.env.local` (`NOTION_TOKEN`,
   `NOTION_PARENT_PAGE_ID`, `NOTION_PROCESSES_DB_ID`, `NOTION_STEPS_DB_ID`,
   `NOTION_SUITABILITY_DB_ID`, `NOTION_AGENT_BLUEPRINT_DB_ID`,
   `NOTION_VALUE_METRICS_DB_ID`, `ANTHROPIC_API_KEY`) in the host's project settings.
```

In `### Option B: Docker`, change "passing the same seven environment variables at deploy time." to "passing the same eight environment variables at deploy time."

In `### Option C: Render`, change:

```
2. Render creates one web service (`agentic-workflow-framework`) from the Dockerfile and
   prompts for the seven environment variables declared in `render.yaml`
   (`NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`, `NOTION_PROCESSES_DB_ID`,
   `NOTION_STEPS_DB_ID`, `NOTION_SUITABILITY_DB_ID`, `NOTION_AGENT_BLUEPRINT_DB_ID`,
   `NOTION_VALUE_METRICS_DB_ID`) — paste in the same values from your `.env.local`.
```

to:

```
2. Render creates one web service (`agentic-workflow-framework`) from the Dockerfile and
   prompts for the eight environment variables declared in `render.yaml`
   (`NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`, `NOTION_PROCESSES_DB_ID`,
   `NOTION_STEPS_DB_ID`, `NOTION_SUITABILITY_DB_ID`, `NOTION_AGENT_BLUEPRINT_DB_ID`,
   `NOTION_VALUE_METRICS_DB_ID`, `ANTHROPIC_API_KEY`) — paste in the same values from
   your `.env.local`.
```

- [ ] **Step 12: Add the env var to `render.yaml`**

In `render.yaml`, add to the `envVars` list (after `NOTION_VALUE_METRICS_DB_ID`):

```yaml
      - key: ANTHROPIC_API_KEY
        sync: false
```

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json lib/ai/config.ts lib/ai/config.test.ts lib/ai/client.ts lib/ai/client.test.ts .env.local.example README.md render.yaml
git commit -m "feat: add Anthropic client and shared structured-generation helper"
```

---

### AI Task 2: Single-step lookup

**Files:**
- Modify: `lib/notion/steps.ts`
- Modify: `lib/notion/steps.test.ts`

**Interfaces:**
- Produces: `getStep(id: string): Promise<StepRecord>` — used by AI Task 3's route to load the step being scored.

- [ ] **Step 1: Write the failing test**

In `lib/notion/steps.test.ts`, add `retrieveMock` to the mock setup and a new `describe` block:

```ts
// change the import line to:
import { listStepsForProcess, createStep, updateStep, deleteStep, getStep } from "./steps";

// change the mock declarations to add:
const retrieveMock = vi.fn();

// change the vi.mock("./client", ...) block's pages object to:
    pages: { create: createMock, update: updateMock, retrieve: retrieveMock },

// change beforeEach to also reset it:
  retrieveMock.mockReset();

// add this describe block after describe("listStepsForProcess", ...):
describe("getStep", () => {
  it("retrieves a single step by id", async () => {
    retrieveMock.mockResolvedValue(makeStepPage());
    const result = await getStep("step-1");
    expect(result.stepName).toBe("Submit Requisition");
    expect(retrieveMock).toHaveBeenCalledWith({ page_id: "step-1" });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run lib/notion/steps.test.ts`
Expected: FAIL — `getStep` is not exported yet.

- [ ] **Step 3: Implement `getStep`**

In `lib/notion/steps.ts`, add after `listStepsForProcess`:

```ts
export async function getStep(id: string): Promise<StepRecord> {
  const notion = getNotionClient();
  const page = await notion.pages.retrieve({ page_id: id });
  return pageToStep(page);
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run lib/notion/steps.test.ts`
Expected: PASS (all tests, including the new one)

- [ ] **Step 5: Commit**

```bash
git add lib/notion/steps.ts lib/notion/steps.test.ts
git commit -m "feat: add single-step lookup for AI score suggestions"
```

---

### AI Task 3: Suitability score suggestion (Phase 2, backend)

**Files:**
- Create: `lib/ai/suggestScore.ts`
- Create: `lib/ai/suggestScore.test.ts`
- Create: `app/api/ai/suggest-score/route.ts`

**Interfaces:**
- Consumes: `generateStructured<T>` (AI Task 1), `getStep` (AI Task 2), `StepRecord` (`lib/notion/steps.ts`)
- Produces: `POST /api/ai/suggest-score` — body `{ stepId: string }`, response `{ dataComplexity: number; decisionLogic: number; contextVolatility: number; rationale: string }`. Used by AI Task 4's UI.

- [ ] **Step 1: Write the failing test**

Create `lib/ai/suggestScore.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSuggestScorePrompt } from "./suggestScore";
import type { StepRecord } from "../notion/steps";

function makeStep(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    id: "step-1",
    processId: "process-1",
    stepName: "Match PO to invoice line items",
    sequence: 1,
    handoffType: "Human",
    cycleTimeHours: 2,
    cost: 40,
    bottleneck: true,
    notes: "",
    ...overrides,
  };
}

describe("buildSuggestScorePrompt", () => {
  it("includes the step's name, handoff type, cycle time, cost, and bottleneck flag", () => {
    const prompt = buildSuggestScorePrompt(makeStep());
    expect(prompt).toContain("Match PO to invoice line items");
    expect(prompt).toContain("Human");
    expect(prompt).toContain("2 hours");
    expect(prompt).toContain("$40");
    expect(prompt).toContain("Known bottleneck: yes");
  });

  it("includes notes when present and omits the Notes line when blank", () => {
    const withNotes = buildSuggestScorePrompt(makeStep({ notes: "Requires manual review" }));
    expect(withNotes).toContain("Notes: Requires manual review");

    const withoutNotes = buildSuggestScorePrompt(makeStep({ notes: "" }));
    expect(withoutNotes).not.toContain("Notes:");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run lib/ai/suggestScore.test.ts`
Expected: FAIL — `lib/ai/suggestScore.ts` does not exist yet.

- [ ] **Step 3: Implement the prompt/schema module**

Create `lib/ai/suggestScore.ts`:

```ts
import type { StepRecord } from "../notion/steps";

export const SUGGEST_SCORE_SYSTEM_PROMPT =
  "You are helping a business process consultant assess whether a workflow step is a good candidate for an AI agent. Score the step on three 1-5 scales: data complexity (1 = clean structured data, 5 = messy unstructured data from many sources), decision logic (1 = simple deterministic rules, 5 = deep judgment or reasoning), and context volatility (1 = stable and predictable, 5 = highly variable and exception-heavy). Respond only by calling the respond tool.";

export function buildSuggestScorePrompt(step: StepRecord): string {
  const lines = [
    `Step: "${step.stepName}"`,
    `Handoff type: ${step.handoffType}`,
    `Cycle time: ${step.cycleTimeHours} hours`,
    `Cost: $${step.cost}`,
    `Known bottleneck: ${step.bottleneck ? "yes" : "no"}`,
  ];
  if (step.notes) {
    lines.push(`Notes: ${step.notes}`);
  }
  return `${lines.join("\n")}\n\nScore this step and explain your reasoning in one sentence.`;
}

export const SUGGEST_SCORE_SCHEMA = {
  type: "object",
  properties: {
    dataComplexity: { type: "integer", minimum: 1, maximum: 5 },
    decisionLogic: { type: "integer", minimum: 1, maximum: 5 },
    contextVolatility: { type: "integer", minimum: 1, maximum: 5 },
    rationale: { type: "string" },
  },
  required: ["dataComplexity", "decisionLogic", "contextVolatility", "rationale"],
};

export interface SuggestedScore {
  dataComplexity: number;
  decisionLogic: number;
  contextVolatility: number;
  rationale: string;
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run lib/ai/suggestScore.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Implement the route**

Create `app/api/ai/suggest-score/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getStep } from "@/lib/notion/steps";
import { generateStructured } from "@/lib/ai/client";
import {
  SUGGEST_SCORE_SYSTEM_PROMPT,
  SUGGEST_SCORE_SCHEMA,
  buildSuggestScorePrompt,
  type SuggestedScore,
} from "@/lib/ai/suggestScore";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.stepId) {
    return NextResponse.json({ error: "stepId is required" }, { status: 400 });
  }
  try {
    const step = await getStep(body.stepId);
    const suggestion = await generateStructured<SuggestedScore>({
      system: SUGGEST_SCORE_SYSTEM_PROMPT,
      prompt: buildSuggestScorePrompt(step),
      schema: SUGGEST_SCORE_SCHEMA,
    });
    return NextResponse.json(suggestion);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate a score suggestion" },
      { status: 500 }
    );
  }
}
```

This route is not separately unit-tested (thin handler, consistent with every other route in the project) — it is verified manually in the browser during AI Task 4.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/suggestScore.ts lib/ai/suggestScore.test.ts app/api/ai/suggest-score/route.ts
git commit -m "feat: add AI suitability-score suggestion route"
```

---

### AI Task 4: Suitability score suggestion (Phase 2, UI)

**Files:**
- Modify: `components/SuitabilityForm.tsx`

**Interfaces:**
- Consumes: `POST /api/ai/suggest-score` (AI Task 3)

- [ ] **Step 1: Add AI-suggestion state and a handler**

In `components/SuitabilityForm.tsx`, add state below the existing `savingStepIds`/`error` state:

```ts
  const [suggestingStepIds, setSuggestingStepIds] = useState<Set<string>>(new Set());
  const [rationales, setRationales] = useState<Record<string, string>>({});
```

Add this handler after `updateInput`:

```ts
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
```

- [ ] **Step 2: Add the Suggest button and rationale row**

In the `<tbody>` map, change the returned JSX for each step from a single `<tr>` to a fragment with the existing row plus a Suggest button in the last cell, and a conditional rationale row:

```tsx
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
```

Add the `React` import at the top of the file (`Fragment` requires it):

```ts
import React, { useState } from "react";
```

- [ ] **Step 3: Verify manually**

Run `npm run dev`, open a process's Phase 2 tab, click **Suggest** on a step row, confirm the three inputs populate and a rationale line appears below the row, then click **Save** and confirm it saves exactly as it did before this change.

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `npm run test`
Expected: PASS (all existing tests, no new ones — this file has no dedicated test suite, consistent with every other form component in the project)

- [ ] **Step 5: Commit**

```bash
git add components/SuitabilityForm.tsx
git commit -m "feat: add AI score suggestion to the Phase 2 suitability form"
```

---

### AI Task 5: Draft steps from text (Phase 1, backend)

**Files:**
- Create: `lib/ai/draftSteps.ts`
- Create: `lib/ai/draftSteps.test.ts`
- Create: `app/api/ai/draft-steps/route.ts`

**Interfaces:**
- Consumes: `generateStructured<T>` (AI Task 1), `parseStepRows` (`lib/importSteps.ts`, already exists)
- Produces: `POST /api/ai/draft-steps` — body `{ rawText: string }`, response `{ steps: ParsedStepRow[]; skipped: SkippedRow[] }`. Used by AI Task 6's UI.

- [ ] **Step 1: Write the failing test**

Create `lib/ai/draftSteps.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildDraftStepsPrompt, STEP_ROW_HEADER } from "./draftSteps";
import { parseStepRows } from "../importSteps";

describe("buildDraftStepsPrompt", () => {
  it("includes the raw process text and the required row shape", () => {
    const prompt = buildDraftStepsPrompt("First the requester submits a form...");
    expect(prompt).toContain("First the requester submits a form...");
    expect(prompt).toContain("Step Name");
    expect(prompt).toContain("Handoff Type");
  });
});

describe("STEP_ROW_HEADER", () => {
  it("matches the column names parseStepRows recognizes, so a drafted row parses correctly", () => {
    const rows = [
      STEP_ROW_HEADER,
      ["Submit form", "Human", "1", "10", "No", "Some notes"],
    ];
    const { valid, skipped } = parseStepRows(rows);
    expect(skipped).toEqual([]);
    expect(valid).toEqual([
      {
        stepName: "Submit form",
        handoffType: "Human",
        cycleTimeHours: 1,
        cost: 10,
        bottleneck: false,
        notes: "Some notes",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run lib/ai/draftSteps.test.ts`
Expected: FAIL — `lib/ai/draftSteps.ts` does not exist yet.

- [ ] **Step 3: Implement the prompt/schema module**

Create `lib/ai/draftSteps.ts`:

```ts
export const DRAFT_STEPS_SYSTEM_PROMPT =
  "You are helping a business process consultant convert a rough process description into a structured list of workflow steps. Extract each distinct step, in the order they happen. Respond only by calling the respond tool.";

export const STEP_ROW_HEADER = [
  "Step Name",
  "Handoff Type",
  "Cycle Time (hrs)",
  "Cost",
  "Bottleneck",
  "Notes",
];

export function buildDraftStepsPrompt(rawText: string): string {
  return `Process description:\n"""\n${rawText}\n"""\n\nExtract the steps as rows. Each row must have exactly 6 values in this order: Step Name, Handoff Type (one of System, Human, Cross-team, External), Cycle Time (hrs) as a number written as a string, Cost as a number written as a string, Bottleneck ("Yes" or "No"), Notes (any extra context, or an empty string). If the text doesn't state a cycle time, cost, or bottleneck, make a reasonable estimate rather than leaving it blank.`;
}

export const DRAFT_STEPS_SCHEMA = {
  type: "object",
  properties: {
    rows: {
      type: "array",
      items: {
        type: "array",
        items: { type: "string" },
        minItems: 6,
        maxItems: 6,
      },
    },
  },
  required: ["rows"],
};

export interface DraftStepsResponse {
  rows: string[][];
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run lib/ai/draftSteps.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Implement the route**

Create `app/api/ai/draft-steps/route.ts`:

```ts
import { NextResponse } from "next/server";
import { generateStructured } from "@/lib/ai/client";
import { parseStepRows } from "@/lib/importSteps";
import {
  DRAFT_STEPS_SYSTEM_PROMPT,
  DRAFT_STEPS_SCHEMA,
  STEP_ROW_HEADER,
  buildDraftStepsPrompt,
  type DraftStepsResponse,
} from "@/lib/ai/draftSteps";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.rawText || typeof body.rawText !== "string") {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }
  try {
    const draft = await generateStructured<DraftStepsResponse>({
      system: DRAFT_STEPS_SYSTEM_PROMPT,
      prompt: buildDraftStepsPrompt(body.rawText),
      schema: DRAFT_STEPS_SCHEMA,
    });
    const { valid, skipped } = parseStepRows([STEP_ROW_HEADER, ...draft.rows]);
    return NextResponse.json({ steps: valid, skipped });
  } catch {
    return NextResponse.json({ error: "Failed to draft steps" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/ai/draftSteps.ts lib/ai/draftSteps.test.ts app/api/ai/draft-steps/route.ts
git commit -m "feat: add AI draft-steps-from-text route"
```

---

### AI Task 6: Draft steps from text (Phase 1, UI)

**Files:**
- Create: `components/StepDraftForm.tsx`
- Modify: `app/process/[id]/phase1/page.tsx`

**Interfaces:**
- Consumes: `POST /api/ai/draft-steps` (AI Task 5), `POST /api/steps` (existing), `ParsedStepRow` (`lib/importSteps.ts`)

- [ ] **Step 1: Create the component**

Create `components/StepDraftForm.tsx`:

```tsx
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
    try {
      for (let i = 0; i < draftSteps.length; i++) {
        const step = draftSteps[i];
        const response = await fetch("/api/steps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            processId,
            stepName: step.stepName,
            sequence: existingStepCount + i + 1,
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
      }
      setDraftSteps([]);
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
```

- [ ] **Step 2: Wire it into the Phase 1 page**

In `app/process/[id]/phase1/page.tsx`, add the import and render it between `StepImportForm` and `StepTable`:

```tsx
import { StepDraftForm } from "@/components/StepDraftForm";
```

```tsx
          <BaselineSummary steps={steps} />
          <StepImportForm processId={params.id} />
          <StepDraftForm processId={params.id} existingStepCount={steps.length} />
          <StepTable processId={params.id} steps={steps} />
```

- [ ] **Step 3: Verify manually**

Run `npm run dev`, open a process's Phase 1 tab, paste a short multi-step process description into the new "Draft steps from text" box, click **Draft Steps**, confirm an editable preview table appears, edit a field, click **Add these N steps**, and confirm the steps appear in the table below exactly as if added manually.

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `npm run test`
Expected: PASS (all existing tests)

- [ ] **Step 5: Commit**

```bash
git add components/StepDraftForm.tsx app/process/\[id\]/phase1/page.tsx
git commit -m "feat: add AI draft-steps-from-text UI to Phase 1"
```

---

### AI Task 7: Draft agent blueprint (Phase 3, backend)

**Files:**
- Create: `lib/ai/draftAgents.ts`
- Create: `lib/ai/draftAgents.test.ts`
- Create: `app/api/ai/draft-agents/route.ts`

**Interfaces:**
- Consumes: `generateStructured<T>` (AI Task 1), `listStepsForProcess` (`lib/notion/steps.ts`), `listSuitabilityScoresForSteps` (`lib/notion/suitability.ts`)
- Produces: `POST /api/ai/draft-agents` — body `{ processId: string }`, response `{ agents: DraftedAgent[] }`. Used by AI Task 8's UI.

- [ ] **Step 1: Write the failing test**

Create `lib/ai/draftAgents.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { selectAgenticSteps, buildDraftAgentsPrompt } from "./draftAgents";
import type { StepRecord } from "../notion/steps";
import type { SuitabilityScoreRecord } from "../notion/suitability";

function makeStep(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    id: "step-1",
    processId: "process-1",
    stepName: "Match PO to invoice",
    sequence: 1,
    handoffType: "Human",
    cycleTimeHours: 2,
    cost: 40,
    bottleneck: false,
    notes: "",
    ...overrides,
  };
}

function makeScore(overrides: Partial<SuitabilityScoreRecord> = {}): SuitabilityScoreRecord {
  return {
    id: "score-1",
    stepId: "step-1",
    dataComplexity: 4,
    decisionLogic: 4,
    contextVolatility: 2,
    suitabilityScore: 3.5,
    classification: "Agentic",
    ...overrides,
  };
}

describe("selectAgenticSteps", () => {
  it("keeps only steps whose score is classified Agentic", () => {
    const steps = [
      makeStep({ id: "step-1", stepName: "Agentic step" }),
      makeStep({ id: "step-2", stepName: "Algorithmic step" }),
      makeStep({ id: "step-3", stepName: "No score yet" }),
    ];
    const scores = [
      makeScore({ stepId: "step-1", classification: "Agentic" }),
      makeScore({ stepId: "step-2", classification: "Algorithmic" }),
    ];
    const result = selectAgenticSteps(steps, scores);
    expect(result).toEqual([{ stepName: "Agentic step", handoffType: "Human" }]);
  });
});

describe("buildDraftAgentsPrompt", () => {
  it("lists each agentic step by name and handoff type", () => {
    const prompt = buildDraftAgentsPrompt([
      { stepName: "Match PO to invoice", handoffType: "Human" },
    ]);
    expect(prompt).toContain("Match PO to invoice");
    expect(prompt).toContain("Human");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run lib/ai/draftAgents.test.ts`
Expected: FAIL — `lib/ai/draftAgents.ts` does not exist yet.

- [ ] **Step 3: Implement the prompt/schema module**

Create `lib/ai/draftAgents.ts`:

```ts
import type { StepRecord } from "../notion/steps";
import type { SuitabilityScoreRecord } from "../notion/suitability";

export const DRAFT_AGENTS_SYSTEM_PROMPT =
  "You are helping a business process consultant design an agent blueprint: which AI agents should own a set of workflow steps, in what order they hand off to each other, and where a human needs to stay in the loop. Respond only by calling the respond tool.";

export interface AgenticStep {
  stepName: string;
  handoffType: string;
}

export function selectAgenticSteps(
  steps: StepRecord[],
  scores: SuitabilityScoreRecord[]
): AgenticStep[] {
  const agenticStepIds = new Set(
    scores.filter((score) => score.classification === "Agentic").map((score) => score.stepId)
  );
  return steps
    .filter((step) => agenticStepIds.has(step.id))
    .map((step) => ({ stepName: step.stepName, handoffType: step.handoffType }));
}

export function buildDraftAgentsPrompt(agenticSteps: AgenticStep[]): string {
  const stepList = agenticSteps
    .map((step, i) => `${i + 1}. "${step.stepName}" (handoff: ${step.handoffType})`)
    .join("\n");
  return `These workflow steps have been classified as good candidates for an AI agent:\n${stepList}\n\nPropose an agent blueprint: group these steps into one or more agents (an agent can own more than one step if they naturally belong together), name each agent, describe its role in one sentence, state the event that triggers it, and order them by upstream handoff (the first agent in your list has no upstream; each later agent's upstreamAgentName names the agent that hands off to it — use exactly the agentName you gave that earlier agent, or null if it has no upstream). For any agent whose action is risky enough that a human should be able to intervene (e.g. anything touching money, external communication, or an irreversible action), set hitlExceptionRule to the condition that should trigger human review; otherwise set it to null.`;
}

export const DRAFT_AGENTS_SCHEMA = {
  type: "object",
  properties: {
    agents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          agentName: { type: "string" },
          role: { type: "string" },
          triggerEvent: { type: "string" },
          upstreamAgentName: { type: ["string", "null"] },
          hitlExceptionRule: { type: ["string", "null"] },
          rationale: { type: "string" },
        },
        required: [
          "agentName",
          "role",
          "triggerEvent",
          "upstreamAgentName",
          "hitlExceptionRule",
          "rationale",
        ],
      },
    },
  },
  required: ["agents"],
};

export interface DraftedAgent {
  agentName: string;
  role: string;
  triggerEvent: string;
  upstreamAgentName: string | null;
  hitlExceptionRule: string | null;
  rationale: string;
}

export interface DraftAgentsResponse {
  agents: DraftedAgent[];
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run lib/ai/draftAgents.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Implement the route**

Create `app/api/ai/draft-agents/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listStepsForProcess } from "@/lib/notion/steps";
import { listSuitabilityScoresForSteps } from "@/lib/notion/suitability";
import { generateStructured } from "@/lib/ai/client";
import {
  DRAFT_AGENTS_SYSTEM_PROMPT,
  DRAFT_AGENTS_SCHEMA,
  selectAgenticSteps,
  buildDraftAgentsPrompt,
  type DraftAgentsResponse,
} from "@/lib/ai/draftAgents";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  try {
    const steps = await listStepsForProcess(body.processId);
    const scores = await listSuitabilityScoresForSteps(steps.map((step) => step.id));
    const agenticSteps = selectAgenticSteps(steps, scores);
    if (agenticSteps.length === 0) {
      return NextResponse.json({ agents: [] });
    }
    const draft = await generateStructured<DraftAgentsResponse>({
      system: DRAFT_AGENTS_SYSTEM_PROMPT,
      prompt: buildDraftAgentsPrompt(agenticSteps),
      schema: DRAFT_AGENTS_SCHEMA,
    });
    return NextResponse.json(draft);
  } catch {
    return NextResponse.json(
      { error: "Failed to draft agent blueprint" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/ai/draftAgents.ts lib/ai/draftAgents.test.ts app/api/ai/draft-agents/route.ts
git commit -m "feat: add AI draft-agent-blueprint route"
```

---

### AI Task 8: Draft agent blueprint (Phase 3, UI)

**Files:**
- Create: `components/AgentDraftForm.tsx`
- Modify: `app/process/[id]/phase3/page.tsx`

**Interfaces:**
- Consumes: `POST /api/ai/draft-agents` (AI Task 7), `POST /api/agents` (existing), `AgentRecord` (`lib/notion/agents.ts`)

- [ ] **Step 1: Create the component**

Create `components/AgentDraftForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentRecord } from "@/lib/notion/agents";
import type { DraftedAgent } from "@/lib/ai/draftAgents";

export function AgentDraftForm({
  processId,
  agents,
}: {
  processId: string;
  agents: AgentRecord[];
}) {
  const router = useRouter();
  const [drafting, setDrafting] = useState(false);
  const [draftAgents, setDraftAgents] = useState<DraftedAgent[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDraft() {
    setDrafting(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/draft-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Failed to draft agent blueprint");
        return;
      }
      if (body.agents.length === 0) {
        setError("No steps are classified Agentic yet — score steps in Phase 2 first.");
        return;
      }
      setDraftAgents(body.agents);
    } catch {
      setError("Failed to draft agent blueprint");
    } finally {
      setDrafting(false);
    }
  }

  function updateDraftAgent(
    index: number,
    field: keyof DraftedAgent,
    value: string
  ) {
    setDraftAgents((prev) =>
      prev.map((agent, i) => (i === index ? { ...agent, [field]: value } : agent))
    );
  }

  async function handleSaveAgent(index: number) {
    const draft = draftAgents[index];
    setSavingIndex(index);
    setError(null);
    try {
      const upstreamAgent = agents.find((a) => a.agentName === draft.upstreamAgentName);
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          agentName: draft.agentName,
          role: draft.role,
          triggerEvent: draft.triggerEvent,
          upstreamAgentId: upstreamAgent?.id ?? "",
          hitlExceptionRule: draft.hitlExceptionRule ?? "",
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Failed to add agent");
        return;
      }
      setDraftAgents((prev) => prev.filter((_, i) => i !== index));
      router.refresh();
    } catch {
      setError("Failed to add agent");
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className="mb-6 rounded border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Draft agent blueprint with AI</p>
          <p className="text-xs text-slate-500">
            Save agents in order — an agent must be saved before a later one can list it
            as its upstream agent.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDraft}
          disabled={drafting}
          className="rounded bg-brand-700 px-3 py-1.5 text-sm text-white hover:bg-brand-900 disabled:opacity-50"
        >
          {drafting ? "Drafting..." : "Draft Blueprint"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {draftAgents.length > 0 && (
        <ul className="mt-2 space-y-3">
          {draftAgents.map((draft, index) => (
            <li key={index} className="rounded border border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500">Agent Name</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                    value={draft.agentName}
                    onChange={(e) => updateDraftAgent(index, "agentName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Role</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                    value={draft.role}
                    onChange={(e) => updateDraftAgent(index, "role", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Trigger Event</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                    value={draft.triggerEvent}
                    onChange={(e) => updateDraftAgent(index, "triggerEvent", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Upstream Agent (by name)</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                    value={draft.upstreamAgentName ?? ""}
                    onChange={(e) =>
                      updateDraftAgent(index, "upstreamAgentName", e.target.value)
                    }
                    placeholder="None (starts the flow)"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500">HITL Exception Rule</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                    value={draft.hitlExceptionRule ?? ""}
                    onChange={(e) =>
                      updateDraftAgent(index, "hitlExceptionRule", e.target.value)
                    }
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{draft.rationale}</p>
              <button
                type="button"
                onClick={() => handleSaveAgent(index)}
                disabled={savingIndex === index}
                className="mt-2 rounded bg-brand-700 px-3 py-1 text-sm text-white hover:bg-brand-900 disabled:opacity-50"
              >
                {savingIndex === index ? "Adding..." : "Add This Agent"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the Phase 3 page**

In `app/process/[id]/phase3/page.tsx`, add the import and render it between `AgentFlowDiagram` and `AgentForm`:

```tsx
import { AgentDraftForm } from "@/components/AgentDraftForm";
```

```tsx
          <AgentFlowDiagram agents={agents} />
          <AgentDraftForm processId={params.id} agents={agents} />
          <AgentForm processId={params.id} agents={agents} />
```

- [ ] **Step 3: Verify manually**

Run `npm run dev`, open a process that has at least one step scored Agentic in Phase 2, go to Phase 3, click **Draft Blueprint**, confirm editable agent cards appear, click **Add This Agent** on the first (root) card, confirm it appears in the flow diagram and the form's Upstream Agent dropdown, then save a second card that references the first by name and confirm the chain links correctly.

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `npm run test`
Expected: PASS (all existing tests)

- [ ] **Step 5: Commit**

```bash
git add components/AgentDraftForm.tsx app/process/\[id\]/phase3/page.tsx
git commit -m "feat: add AI draft-agent-blueprint UI to Phase 3"
```
