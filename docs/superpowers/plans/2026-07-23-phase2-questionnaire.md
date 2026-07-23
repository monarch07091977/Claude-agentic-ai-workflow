# Phase 2 Scoring Questionnaire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Deep dive" path to Phase 2 suitability scoring: the app asks the consultant six step-specific questions (two per scoring dimension), the consultant answers them, and "Score from answers" scores the step from those real answers instead of a guess — with the Q&A transcript persisted to Notion as an audit trail.

**Architecture:** One Notion schema addition (a rich-text `Assessment Q&A` property on the existing Suitability Scores database), two new AI routes following the exact shape every existing `lib/ai/*` feature already uses, and a UI extension to the existing `SuitabilityForm` that adds a second AI path alongside the existing one-click "Suggest".

**Tech Stack:** Same stack as the rest of the app — no new dependencies. Reuses the existing `generateStructured` helper and `SuggestedScore`/`SUGGEST_SCORE_SCHEMA` from the already-built Suggest feature.

## Global Constraints

- The AI never writes to Notion directly. Every response only pre-fills client-side state (questions, then scores); committing a score — with or without a questionnaire — always goes through the existing `POST /api/suitability`, unchanged in shape except for one new optional field.
- `Assessment Q&A` is written to Notion **only** when at least one questionnaire answer is non-empty for that step at save time. Saving a score the old way (no questionnaire ever run) must never blank out a previously-recorded Q&A trail — the property is omitted from the write entirely when there's nothing new to record, not written as an empty string.
- The Notion schema change is additive only: one new `rich_text` property on the **existing** Suitability Scores database. No new database, no property removed or renamed.
- `scripts/setup-notion.ts`'s property-ensure call must run unconditionally after `suitabilityDbId` is resolved (whether freshly created or an already-existing database reused) — re-declaring an existing property with the same config is a safe no-op in the Notion API, so this is idempotent by construction.
- `score-from-answers` reuses the **exact same** `SUGGEST_SCORE_SCHEMA` and `SuggestedScore` type the existing Suggest feature already exports from `lib/ai/suggestScore.ts` — no duplicate schema.
- Every new/modified API route returns a JSON body on every path (success, validation failure, caught exception).
- Every new client-side mutating fetch uses try/catch/finally so errors are always visible and disabled/loading state always resets, on all three paths (success, non-ok response, network rejection).
- No test hits the real Anthropic API or a real Notion workspace — mock at the module boundary exactly as every existing test in this project already does.
- Primary-action buttons use `bg-brand-700 ... hover:bg-brand-900`; the existing outline style (`border-brand-700 text-brand-700 hover:bg-brand-50`) is reused for the new secondary "Deep dive" button, matching "Suggest"'s existing style.

---

### Q Task 1: Notion schema — Assessment Q&A property

**Files:**
- Modify: `scripts/setup-notion.ts`
- Modify: `lib/notion/suitability.ts`
- Modify: `lib/notion/suitability.test.ts`

**Interfaces:**
- Produces: `SuitabilityScoreRecord.assessmentQA: string` and `upsertSuitabilityScore`'s new optional `assessmentQA?: string` input — used by Q Task 2's route.

- [ ] **Step 1: Add the idempotent property-ensure call to the setup script**

In `scripts/setup-notion.ts`, find the block that resolves `suitabilityDbId` (it starts with `let suitabilityDbId = await findExistingDatabaseId(notion, parentPageId, "Suitability Scores");` and ends after the `if (suitabilityDbId) { ... } else { ... suitabilityDbId = suitabilityDb.id; }` block). Immediately after that whole if/else block (so it runs whether the database was just created or already existed), add:

```ts
  await notion.databases.update({
    database_id: suitabilityDbId,
    properties: {
      "Assessment Q&A": { rich_text: {} },
    },
  });
  console.log("Ensured 'Assessment Q&A' property exists on Suitability Scores.");
```

Do not change anything else in the file.

- [ ] **Step 2: Write the failing tests**

Replace the full content of `lib/notion/suitability.test.ts` with:

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
        assessmentQA: "",
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

  it("reads an existing Assessment Q&A value from the page", async () => {
    queryMock.mockResolvedValue({
      results: [
        makeScorePage({
          "Assessment Q&A": {
            rich_text: [{ plain_text: "Q (dataComplexity): ...\nA: ..." }],
          },
        }),
      ],
    });
    const result = await listSuitabilityScoresForSteps(["step-1"]);
    expect(result[0].assessmentQA).toBe("Q (dataComplexity): ...\nA: ...");
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

  it("includes Assessment Q&A in the write when provided", async () => {
    queryMock.mockResolvedValue({ results: [] });
    createMock.mockResolvedValue(
      makeScorePage({
        "Assessment Q&A": { rich_text: [{ plain_text: "Q: ...\nA: ..." }] },
      })
    );
    const result = await upsertSuitabilityScore({
      stepId: "step-1",
      dataComplexity: 2,
      decisionLogic: 4,
      contextVolatility: 2,
      assessmentQA: "Q: ...\nA: ...",
    });
    expect(result.assessmentQA).toBe("Q: ...\nA: ...");
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
        "Assessment Q&A": { rich_text: [{ text: { content: "Q: ...\nA: ..." } }] },
      },
    });
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

  it("does not overwrite Assessment Q&A on update when not provided", async () => {
    queryMock.mockResolvedValue({ results: [makeScorePage()] });
    updateMock.mockResolvedValue(makeScorePage());
    await upsertSuitabilityScore({
      stepId: "step-1",
      dataComplexity: 5,
      decisionLogic: 4,
      contextVolatility: 2,
    });
    const calledProperties = updateMock.mock.calls[0][0].properties;
    expect(calledProperties).not.toHaveProperty("Assessment Q&A");
  });

  it("archives duplicate score pages and updates the canonical one when more than one exists for the step", async () => {
    queryMock.mockResolvedValue({
      results: [
        { ...makeScorePage(), id: "score-1" },
        { ...makeScorePage(), id: "score-2" },
      ],
    });
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
      page_id: "score-2",
      archived: true,
    });
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
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(createMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run lib/notion/suitability.test.ts`
Expected: FAIL — `assessmentQA` is not yet part of `SuitabilityScoreRecord` or `upsertSuitabilityScore`.

- [ ] **Step 4: Update `lib/notion/suitability.ts`**

Replace the full content of `lib/notion/suitability.ts` with:

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
  assessmentQA: string;
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
    assessmentQA:
      props["Assessment Q&A"]?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
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
  assessmentQA?: string;
}): Promise<SuitabilityScoreRecord> {
  const notion = getNotionClient();
  const suitabilityScore = computeSuitabilityScore(input);
  const classification = classifySuitability(suitabilityScore);
  const properties: Record<string, any> = {
    "Data Complexity": { number: input.dataComplexity },
    "Decision Logic": { number: input.decisionLogic },
    "Context Volatility": { number: input.contextVolatility },
    "Suitability Score": { number: suitabilityScore },
    Classification: { select: { name: classification } },
  };
  if (input.assessmentQA !== undefined) {
    properties["Assessment Q&A"] = { rich_text: [{ text: { content: input.assessmentQA } }] };
  }

  const existing = await notion.databases.query({
    database_id: notionConfig.suitabilityDbId,
    filter: { property: "Step", relation: { contains: input.stepId } },
  });

  if (existing.results.length > 0) {
    const [canonical, ...duplicates] = existing.results;
    // Self-heals duplicates from a create-race between concurrent requests — Notion has no uniqueness constraint to prevent the race itself.
    if (duplicates.length > 0) {
      await Promise.all(
        duplicates.map((page) =>
          notion.pages.update({ page_id: page.id, archived: true })
        )
      );
    }
    const page = await notion.pages.update({
      page_id: canonical.id,
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

- [ ] **Step 5: Run it to confirm it passes**

Run: `npx vitest run lib/notion/suitability.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Provision the live schema change**

Run: `npm run setup:notion`
Expected output includes: `Ensured 'Assessment Q&A' property exists on Suitability Scores.` — this hits the real, already-live Notion workspace and adds the property non-destructively (existing data untouched, per the idempotency guarantee in Global Constraints).

- [ ] **Step 7: Commit**

```bash
git add scripts/setup-notion.ts lib/notion/suitability.ts lib/notion/suitability.test.ts
git commit -m "feat: add Assessment Q&A property to Suitability Scores"
```

---

### Q Task 2: Extend the suitability save route

**Files:**
- Modify: `app/api/suitability/route.ts`

**Interfaces:**
- Consumes: `upsertSuitabilityScore` (Q Task 1)

- [ ] **Step 1: Update the route**

Replace the `POST` function in `app/api/suitability/route.ts` with:

```ts
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
  const isValidScore = (value: number) => Number.isInteger(value) && value >= 1 && value <= 5;
  if (
    !isValidScore(body.dataComplexity) ||
    !isValidScore(body.decisionLogic) ||
    !isValidScore(body.contextVolatility)
  ) {
    return NextResponse.json(
      { error: "dataComplexity, decisionLogic, and contextVolatility must be integers from 1 to 5" },
      { status: 400 }
    );
  }
  try {
    const score = await upsertSuitabilityScore({
      stepId: body.stepId,
      dataComplexity: body.dataComplexity,
      decisionLogic: body.decisionLogic,
      contextVolatility: body.contextVolatility,
      ...(typeof body.assessmentQA === "string" ? { assessmentQA: body.assessmentQA } : {}),
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

The `GET` function above it and all imports stay exactly as they are — do not change anything else in the file. This route has no dedicated test file, consistent with every other route in the project.

- [ ] **Step 2: Verify nothing broke**

Run: `npx tsc --noEmit` — must be clean.
Run: `npm run test` — must still pass (no new tests for this route).

- [ ] **Step 3: Commit**

```bash
git add app/api/suitability/route.ts
git commit -m "feat: accept optional Assessment Q&A on the suitability save route"
```

---

### Q Task 3: Step questions generation (backend)

**Files:**
- Create: `lib/ai/stepQuestions.ts`
- Create: `lib/ai/stepQuestions.test.ts`
- Create: `app/api/ai/step-questions/route.ts`

**Interfaces:**
- Consumes: `generateStructured<T>` (`lib/ai/client.ts`, already exists), `getStep` (`lib/notion/steps.ts`, already exists)
- Produces: `POST /api/ai/step-questions` — body `{ stepId: string }`, response `{ questions: { dimension: "dataComplexity"|"decisionLogic"|"contextVolatility"; question: string }[] }` (exactly 6 items). Also produces the `StepQuestion`/`QuestionDimension` types Q Task 4 and Q Task 5 both import.

- [ ] **Step 1: Write the failing test**

Create `lib/ai/stepQuestions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildStepQuestionsPrompt } from "./stepQuestions";
import type { StepRecord } from "../notion/steps";

function makeStep(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    id: "step-1",
    processId: "process-1",
    stepName: "Approve requisition",
    sequence: 1,
    handoffType: "Human",
    cycleTimeHours: 2,
    cost: 40,
    bottleneck: false,
    notes: "",
    ...overrides,
  };
}

describe("buildStepQuestionsPrompt", () => {
  it("includes the step's name, handoff type, cycle time, cost, and bottleneck flag", () => {
    const prompt = buildStepQuestionsPrompt(makeStep());
    expect(prompt).toContain("Approve requisition");
    expect(prompt).toContain("Human");
    expect(prompt).toContain("2 hours");
    expect(prompt).toContain("$40");
    expect(prompt).toContain("Known bottleneck: no");
  });

  it("includes notes when present and omits the Notes line when blank", () => {
    const withNotes = buildStepQuestionsPrompt(makeStep({ notes: "Depends on vendor tier" }));
    expect(withNotes).toContain("Notes: Depends on vendor tier");

    const withoutNotes = buildStepQuestionsPrompt(makeStep({ notes: "" }));
    expect(withoutNotes).not.toContain("Notes:");
  });

  it("asks for exactly six questions across the three dimensions", () => {
    const prompt = buildStepQuestionsPrompt(makeStep());
    expect(prompt).toContain("six questions");
    expect(prompt).toContain("dataComplexity");
    expect(prompt).toContain("decisionLogic");
    expect(prompt).toContain("contextVolatility");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run lib/ai/stepQuestions.test.ts`
Expected: FAIL — `lib/ai/stepQuestions.ts` does not exist yet.

- [ ] **Step 3: Implement the prompt/schema module**

Create `lib/ai/stepQuestions.ts`:

```ts
import type { StepRecord } from "../notion/steps";

export const STEP_QUESTIONS_SYSTEM_PROMPT =
  "You are helping a business process consultant deeply understand a single workflow step before scoring it for AI-agent suitability. Ask exactly two concrete, specific questions for each of three dimensions: dataComplexity (how messy or varied the data involved is), decisionLogic (how much judgment versus fixed rules the step requires), and contextVolatility (how often the rules, exceptions, or environment for this step change). Questions must be specific to the step described, never generic boilerplate. Respond only by calling the respond tool.";

export function buildStepQuestionsPrompt(step: StepRecord): string {
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
  return `${lines.join("\n")}\n\nAsk exactly six questions total — two for each of dataComplexity, decisionLogic, and contextVolatility — that would help a consultant who knows this process accurately assess this specific step.`;
}

export const STEP_QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dimension: {
            type: "string",
            enum: ["dataComplexity", "decisionLogic", "contextVolatility"],
          },
          question: { type: "string" },
        },
        required: ["dimension", "question"],
      },
      minItems: 6,
      maxItems: 6,
    },
  },
  required: ["questions"],
};

export type QuestionDimension = "dataComplexity" | "decisionLogic" | "contextVolatility";

export interface StepQuestion {
  dimension: QuestionDimension;
  question: string;
}

export interface StepQuestionsResponse {
  questions: StepQuestion[];
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run lib/ai/stepQuestions.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement the route**

Create `app/api/ai/step-questions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getStep } from "@/lib/notion/steps";
import { generateStructured } from "@/lib/ai/client";
import {
  STEP_QUESTIONS_SYSTEM_PROMPT,
  STEP_QUESTIONS_SCHEMA,
  buildStepQuestionsPrompt,
  type StepQuestionsResponse,
} from "@/lib/ai/stepQuestions";

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
    const result = await generateStructured<StepQuestionsResponse>({
      system: STEP_QUESTIONS_SYSTEM_PROMPT,
      prompt: buildStepQuestionsPrompt(step),
      schema: STEP_QUESTIONS_SCHEMA,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
```

This route is not separately unit-tested (thin handler, consistent with every other route in the project) — it is verified manually in the browser during Q Task 5.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/stepQuestions.ts lib/ai/stepQuestions.test.ts app/api/ai/step-questions/route.ts
git commit -m "feat: add AI step-questions route for Phase 2 deep dive"
```

---

### Q Task 4: Score from answers (backend)

**Files:**
- Create: `lib/ai/scoreFromAnswers.ts`
- Create: `lib/ai/scoreFromAnswers.test.ts`
- Create: `app/api/ai/score-from-answers/route.ts`

**Interfaces:**
- Consumes: `generateStructured<T>` (`lib/ai/client.ts`), `getStep` (`lib/notion/steps.ts`), `SUGGEST_SCORE_SCHEMA`/`SuggestedScore` (`lib/ai/suggestScore.ts`, already exists — reused as-is, not redefined), `StepQuestion` (Q Task 3)
- Produces: `POST /api/ai/score-from-answers` — body `{ stepId: string, answers: { dimension: string; question: string; answer: string }[] }`, response `SuggestedScore` (`{ dataComplexity, decisionLogic, contextVolatility, rationale }`, same shape the existing `/api/ai/suggest-score` already returns). Used by Q Task 5's UI.

- [ ] **Step 1: Write the failing test**

Create `lib/ai/scoreFromAnswers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildScoreFromAnswersPrompt } from "./scoreFromAnswers";
import type { StepRecord } from "../notion/steps";

function makeStep(overrides: Partial<StepRecord> = {}): StepRecord {
  return {
    id: "step-1",
    processId: "process-1",
    stepName: "Approve requisition",
    sequence: 1,
    handoffType: "Human",
    cycleTimeHours: 2,
    cost: 40,
    bottleneck: false,
    notes: "",
    ...overrides,
  };
}

describe("buildScoreFromAnswersPrompt", () => {
  it("includes the step's fields and every question/answer pair", () => {
    const prompt = buildScoreFromAnswersPrompt(makeStep(), [
      {
        dimension: "dataComplexity",
        question: "How many systems does this step pull data from?",
        answer: "Three: the ERP, a spreadsheet, and email.",
      },
      {
        dimension: "decisionLogic",
        question: "Is there a fixed approval threshold?",
        answer: "Yes, anything under $500 auto-approves.",
      },
    ]);
    expect(prompt).toContain("Approve requisition");
    expect(prompt).toContain(
      "Q (dataComplexity): How many systems does this step pull data from?"
    );
    expect(prompt).toContain("A: Three: the ERP, a spreadsheet, and email.");
    expect(prompt).toContain("Q (decisionLogic): Is there a fixed approval threshold?");
    expect(prompt).toContain("A: Yes, anything under $500 auto-approves.");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run lib/ai/scoreFromAnswers.test.ts`
Expected: FAIL — `lib/ai/scoreFromAnswers.ts` does not exist yet.

- [ ] **Step 3: Implement the prompt module**

Create `lib/ai/scoreFromAnswers.ts`:

```ts
import type { StepRecord } from "../notion/steps";
import type { StepQuestion } from "./stepQuestions";

export const SCORE_FROM_ANSWERS_SYSTEM_PROMPT =
  "You are helping a business process consultant assess whether a workflow step is a good candidate for an AI agent, using answers the consultant gave to clarifying questions about the step. Score the step on three 1-5 scales: data complexity, decision logic, and context volatility, grounding your reasoning in the specific answers given rather than guessing. Respond only by calling the respond tool.";

export interface AnsweredQuestion extends StepQuestion {
  answer: string;
}

export function buildScoreFromAnswersPrompt(
  step: StepRecord,
  answers: AnsweredQuestion[]
): string {
  const stepLines = [
    `Step: "${step.stepName}"`,
    `Handoff type: ${step.handoffType}`,
    `Cycle time: ${step.cycleTimeHours} hours`,
    `Cost: $${step.cost}`,
    `Known bottleneck: ${step.bottleneck ? "yes" : "no"}`,
  ];
  const qaLines = answers.map(
    (a) => `Q (${a.dimension}): ${a.question}\nA: ${a.answer}`
  );
  return `${stepLines.join("\n")}\n\n${qaLines.join(
    "\n\n"
  )}\n\nUsing these answers, score this step and explain your reasoning in one or two sentences that reference the specific answers given.`;
}
```

Note: this module deliberately does NOT define its own scoring schema or response type — it reuses `SUGGEST_SCORE_SCHEMA` and `SuggestedScore` from `lib/ai/suggestScore.ts` directly in the route (Step 5 below), per the Global Constraints.

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run lib/ai/scoreFromAnswers.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Implement the route**

Create `app/api/ai/score-from-answers/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getStep } from "@/lib/notion/steps";
import { generateStructured } from "@/lib/ai/client";
import { SUGGEST_SCORE_SCHEMA, type SuggestedScore } from "@/lib/ai/suggestScore";
import {
  SCORE_FROM_ANSWERS_SYSTEM_PROMPT,
  buildScoreFromAnswersPrompt,
  type AnsweredQuestion,
} from "@/lib/ai/scoreFromAnswers";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.stepId || !Array.isArray(body.answers)) {
    return NextResponse.json(
      { error: "stepId and answers are required" },
      { status: 400 }
    );
  }
  try {
    const step = await getStep(body.stepId);
    const suggestion = await generateStructured<SuggestedScore>({
      system: SCORE_FROM_ANSWERS_SYSTEM_PROMPT,
      prompt: buildScoreFromAnswersPrompt(step, body.answers as AnsweredQuestion[]),
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

- [ ] **Step 6: Commit**

```bash
git add lib/ai/scoreFromAnswers.ts lib/ai/scoreFromAnswers.test.ts app/api/ai/score-from-answers/route.ts
git commit -m "feat: add AI score-from-answers route for Phase 2 deep dive"
```

---

### Q Task 5: Deep dive UI

**Files:**
- Modify: `components/SuitabilityForm.tsx`
- Modify: `app/guide/page.tsx`

**Interfaces:**
- Consumes: `POST /api/ai/step-questions` (Q Task 3), `POST /api/ai/score-from-answers` (Q Task 4), `POST /api/suitability` (Q Task 2, now accepting optional `assessmentQA`), `StepQuestion`/`QuestionDimension` (`lib/ai/stepQuestions.ts`)

- [ ] **Step 1: Replace `components/SuitabilityForm.tsx`**

Replace the full content of `components/SuitabilityForm.tsx` with:

```tsx
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
```

- [ ] **Step 2: Update the guide**

In `app/guide/page.tsx`, find the `number: 3, title: "Phase 2 — score for agentic fit"` entry's `body` array and add one more string at the end, after the existing "Click Save on a row..." line:

```ts
      "Not sure what to put from the step name alone? Suggest gives a quick guess from what's already logged. Deep dive asks a short, step-specific questionnaire instead — two questions per dimension — and Score from answers grounds the suggestion in what you actually told it. Either way, the three number inputs stay yours to edit before you click Save, and once you've answered at least one question, that Q&A is saved alongside the score as a record of why.",
```

Do not change anything else in the file.

- [ ] **Step 3: Verify manually**

Run `npm run dev`, open a process's Phase 2 tab, click **Deep dive** on a step row, confirm six questions appear grouped into three labeled columns (Data Complexity / Decision Logic / Context Volatility), type an answer into at least one, click **Score from answers**, confirm the three inputs and rationale update, then click **Save** and confirm it succeeds. Reload the page and confirm the questionnaire panel does not reappear (it's ephemeral UI state, not reloaded from Notion) but the score itself persisted.

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

Run: `npx tsc --noEmit` — must be clean.
Run: `npm run test` — must pass (all existing tests; this component has no dedicated test file, consistent with every other form component in the project).

- [ ] **Step 5: Commit**

```bash
git add components/SuitabilityForm.tsx app/guide/page.tsx
git commit -m "feat: add Deep dive questionnaire UI to Phase 2 suitability form"
```
