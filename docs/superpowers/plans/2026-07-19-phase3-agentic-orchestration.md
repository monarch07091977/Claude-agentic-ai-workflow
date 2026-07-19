# Phase 3 (Reimagined Process and Agentic Orchestration Design) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Phase 3 to the app: define an agent blueprint per process (agent name, role, trigger event, upstream agent, HITL exception rule) and visualize the orchestration order as a simple flow diagram with HITL points flagged.

**Architecture:** Same as Plans 1-2 — Notion as the sole data store, Server Components for reads with inline error banners on failure, Route Handlers for writes with try/catch guaranteeing a JSON body on every path, client components only where interactivity is needed. The Agent Blueprint database uses a self-relation (`Upstream Agent` / auto-generated back-relation, renamed to `Downstream Agents`) to express orchestration order — same dual-property-relation-then-rename pattern already used for Processes ↔ Process Steps in Plan 1's setup script.

**Tech Stack:** Same as Plans 1-2 (Next.js 14, TypeScript, Tailwind, `@notionhq/client`, Vitest). No new npm dependency — the flow diagram is a plain styled row of boxes and arrows (not a charting library; Recharts, already in the project for Phase 2, doesn't fit a node/edge diagram).

## Global Constraints

- Data store is Notion only — no separate database (spec: Architecture).
- Notion integration token lives server-side only, via `NOTION_TOKEN` env var, never sent to the client (spec: Architecture, Non-goals).
- No user login/auth in v1 (spec: Non-goals).
- Reads use Server Components with short revalidation caching; writes go through Route Handlers directly to Notion (spec: Architecture).
- Notion API failures surface as an inline error banner on the affected screen; the rest of the UI stays usable (spec: Error Handling) — apply this from the start in every Server Component and API route this plan adds, as Plans 1-2 already do.
- All Notion property access in mapping functions (`pageToX` helpers) must use defensive `?.` chaining consistently on every field, not just some — a real gap found and fixed in Plan 1, correctly avoided from the start in Plan 2.
- Every client-side fetch that can fail must guarantee a visible error AND reset its submitting/disabled state on all three paths (success, non-ok HTTP response, network/fetch rejection) via try/catch/finally — a real gap found and fixed in Plan 1's `StepTable.tsx`, correctly avoided from the start in Plan 2.
- Scope for this plan (decided directly, consistent with the add+read-only precedent already accepted for Phases 1-2's step/score editing): agents can be added but not edited or deleted in this plan. The orchestration chain is a single linear sequence per process (an agent has at most one upstream and the diagram renders one chain, concatenating any additional independent root chains one after another) — branching/parallel agent paths are out of scope for v1.
- Task ordering note: `lib/orchestration.ts` (Task 3) type-imports `AgentRecord` from `lib/notion/agents.ts`, so the data-access layer (Task 2) is implemented first — keeps the project's `tsc --noEmit` clean at every commit, unlike having the type-consuming file land before the type-defining one.

---

### Task 1: Extend Notion schema and config for Agent Blueprint

**Files:**
- Modify: `scripts/setup-notion.ts`
- Modify: `lib/notion/config.ts`
- Modify: `lib/notion/config.test.ts`

**Interfaces:**
- Consumes: `findExistingDatabaseId` (already defined in `scripts/setup-notion.ts` from the idempotency fix), `processesDbId` (already resolved earlier in the same script).
- Produces: a live Notion "Agent Blueprint" database (self-relation for orchestration order) once run manually; `notionConfig.agentBlueprintDbId` getter (throws `"NOTION_AGENT_BLUEPRINT_DB_ID environment variable is not set"` if unset), consumed by Task 2 onward.

- [ ] **Step 1: Add Agent Blueprint database creation to `scripts/setup-notion.ts`**

Add this block immediately after the existing "Suitability Scores" creation block (after the `if (suitabilityDbId) { ... } else { ... }` block, before the final `console.log` calls):

```ts
  let agentBlueprintDbId = await findExistingDatabaseId(notion, parentPageId, "Agent Blueprint");
  if (agentBlueprintDbId) {
    console.log("Agent Blueprint database already exists, reusing it.");
  } else {
    const agentBlueprintDb = await notion.databases.create({
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: "Agent Blueprint" } }],
      properties: {
        "Agent Name": { title: {} },
        Process: {
          relation: {
            database_id: processesDbId,
            type: "single_property",
            single_property: {},
          },
        },
        Role: { rich_text: {} },
        "Trigger Event": { rich_text: {} },
        "HITL Exception Rule": { rich_text: {} },
      },
    });

    await notion.databases.update({
      database_id: agentBlueprintDb.id,
      properties: {
        "Upstream Agent": {
          relation: {
            database_id: agentBlueprintDb.id,
            type: "dual_property",
            dual_property: {},
          },
        },
      },
    });

    const agentBlueprintDbFull = await notion.databases.retrieve({
      database_id: agentBlueprintDb.id,
    });
    const downstreamRelation = Object.values(agentBlueprintDbFull.properties).find(
      (prop: any) =>
        prop.type === "relation" && prop.name !== "Upstream Agent" && prop.name !== "Process"
    ) as any;
    if (!downstreamRelation) {
      throw new Error(
        "Could not find the auto-created back-relation property on Agent Blueprint"
      );
    }
    await notion.databases.update({
      database_id: agentBlueprintDb.id,
      properties: {
        [downstreamRelation.name]: { name: "Downstream Agents" },
      },
    });

    agentBlueprintDbId = agentBlueprintDb.id;
  }
```

Note: this block references `processesDbId`, the variable already established earlier in `main()` by the existing script (holding either the newly-created or the reused-via-`findExistingDatabaseId` Processes database id). Do not redeclare it.

- [ ] **Step 2: Update the final console.log block**

Change the existing:

```ts
  console.log("Notion setup complete. Add these to your .env.local:\n");
  console.log(`NOTION_PROCESSES_DB_ID=${processesDbId}`);
  console.log(`NOTION_STEPS_DB_ID=${stepsDbId}`);
  console.log(`NOTION_SUITABILITY_DB_ID=${suitabilityDbId}`);
```

to:

```ts
  console.log("Notion setup complete. Add these to your .env.local:\n");
  console.log(`NOTION_PROCESSES_DB_ID=${processesDbId}`);
  console.log(`NOTION_STEPS_DB_ID=${stepsDbId}`);
  console.log(`NOTION_SUITABILITY_DB_ID=${suitabilityDbId}`);
  console.log(`NOTION_AGENT_BLUEPRINT_DB_ID=${agentBlueprintDbId}`);
```

- [ ] **Step 3: Verify the script still type-checks**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 4: Add `agentBlueprintDbId` to `lib/notion/config.ts`**

Add this getter to the `notionConfig` object, alongside the existing ones:

```ts
  get agentBlueprintDbId() {
    return requireEnv("NOTION_AGENT_BLUEPRINT_DB_ID");
  },
```

- [ ] **Step 5: Add a test for `agentBlueprintDbId` to `lib/notion/config.test.ts`**

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

  it("exposes processesDbId, stepsDbId, suitabilityDbId, and agentBlueprintDbId the same way", () => {
    process.env.NOTION_PROCESSES_DB_ID = "processes-db";
    process.env.NOTION_STEPS_DB_ID = "steps-db";
    process.env.NOTION_SUITABILITY_DB_ID = "suitability-db";
    process.env.NOTION_AGENT_BLUEPRINT_DB_ID = "agent-blueprint-db";
    expect(notionConfig.processesDbId).toBe("processes-db");
    expect(notionConfig.stepsDbId).toBe("steps-db");
    expect(notionConfig.suitabilityDbId).toBe("suitability-db");
    expect(notionConfig.agentBlueprintDbId).toBe("agent-blueprint-db");
  });
});
```

- [ ] **Step 6: Run the config test to verify it passes**

Run: `npx vitest run lib/notion/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/setup-notion.ts lib/notion/config.ts lib/notion/config.test.ts
git commit -m "feat: add Agent Blueprint database to Notion setup script"
```

- [ ] **Step 8: Note for the controller — live setup deferred**

This task's Step 1 code cannot be run live in a sandboxed implementer session (no real `NOTION_TOKEN`/`NOTION_PARENT_PAGE_ID`). After this task is reviewed, the controller (or the user) must run `npm run setup:notion` again against the real workspace (the script is idempotent — reruns reuse existing databases and only create what's missing), then add the newly printed `NOTION_AGENT_BLUEPRINT_DB_ID` to `.env.local`. This does not block Tasks 2-7's implementation or their mocked tests, only the final manual end-to-end verification.

---

### Task 2: Agent Blueprint data access

**Files:**
- Create: `lib/notion/agents.ts`
- Create: `lib/notion/agents.test.ts`

**Interfaces:**
- Consumes: `getNotionClient()` (`lib/notion/client.ts`), `notionConfig.agentBlueprintDbId` (Task 1).
- Produces: `interface AgentRecord { id: string; processId: string; agentName: string; role: string; triggerEvent: string; upstreamAgentId: string; hitlExceptionRule: string }`, `listAgentsForProcess(processId: string): Promise<AgentRecord[]>`, `createAgent(input: { processId: string; agentName: string; role: string; triggerEvent: string; upstreamAgentId: string; hitlExceptionRule: string }): Promise<AgentRecord>` — consumed by Task 3 (`lib/orchestration.ts`, type-only), Task 4 (API route), Task 5/6 (components), and Task 7 (Phase 3 page).

- [ ] **Step 1: Write the failing tests**

Create `lib/notion/agents.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAgentsForProcess, createAgent } from "./agents";

const queryMock = vi.fn();
const createMock = vi.fn();

vi.mock("./client", () => ({
  getNotionClient: () => ({
    databases: { query: queryMock },
    pages: { create: createMock },
  }),
}));

vi.mock("./config", () => ({
  notionConfig: { agentBlueprintDbId: "agent-blueprint-db-id" },
}));

function makeAgentPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    properties: {
      "Agent Name": { title: [{ plain_text: "Intake Agent" }] },
      Process: { relation: [{ id: "process-1" }] },
      Role: { rich_text: [{ plain_text: "Validates incoming requisitions" }] },
      "Trigger Event": { rich_text: [{ plain_text: "New requisition submitted" }] },
      "Upstream Agent": { relation: [] },
      "HITL Exception Rule": { rich_text: [{ plain_text: "" }] },
      ...overrides,
    },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  createMock.mockReset();
});

describe("listAgentsForProcess", () => {
  it("queries agents filtered by process and maps results", async () => {
    queryMock.mockResolvedValue({ results: [makeAgentPage()] });
    const result = await listAgentsForProcess("process-1");
    expect(result).toEqual([
      {
        id: "agent-1",
        processId: "process-1",
        agentName: "Intake Agent",
        role: "Validates incoming requisitions",
        triggerEvent: "New requisition submitted",
        upstreamAgentId: "",
        hitlExceptionRule: "",
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith({
      database_id: "agent-blueprint-db-id",
      filter: { property: "Process", relation: { contains: "process-1" } },
    });
  });

  it("maps an agent with an upstream agent and an HITL rule", async () => {
    queryMock.mockResolvedValue({
      results: [
        makeAgentPage({
          "Upstream Agent": { relation: [{ id: "agent-0" }] },
          "HITL Exception Rule": {
            rich_text: [{ plain_text: "Escalate if confidence < 80%" }],
          },
        }),
      ],
    });
    const result = await listAgentsForProcess("process-1");
    expect(result[0].upstreamAgentId).toBe("agent-0");
    expect(result[0].hitlExceptionRule).toBe("Escalate if confidence < 80%");
  });
});

describe("createAgent", () => {
  it("creates an agent page without an Upstream Agent property when none is given", async () => {
    createMock.mockResolvedValue(makeAgentPage());
    const result = await createAgent({
      processId: "process-1",
      agentName: "Intake Agent",
      role: "Validates incoming requisitions",
      triggerEvent: "New requisition submitted",
      upstreamAgentId: "",
      hitlExceptionRule: "",
    });
    expect(result.agentName).toBe("Intake Agent");
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "agent-blueprint-db-id" },
      properties: {
        "Agent Name": { title: [{ text: { content: "Intake Agent" } }] },
        Process: { relation: [{ id: "process-1" }] },
        Role: { rich_text: [{ text: { content: "Validates incoming requisitions" } }] },
        "Trigger Event": { rich_text: [{ text: { content: "New requisition submitted" } }] },
        "HITL Exception Rule": { rich_text: [{ text: { content: "" } }] },
      },
    });
  });

  it("includes the Upstream Agent relation when one is given", async () => {
    createMock.mockResolvedValue(
      makeAgentPage({ "Upstream Agent": { relation: [{ id: "agent-0" }] } })
    );
    await createAgent({
      processId: "process-1",
      agentName: "Approval Agent",
      role: "Approves or escalates",
      triggerEvent: "Intake Agent completed",
      upstreamAgentId: "agent-0",
      hitlExceptionRule: "",
    });
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "agent-blueprint-db-id" },
      properties: {
        "Agent Name": { title: [{ text: { content: "Approval Agent" } }] },
        Process: { relation: [{ id: "process-1" }] },
        Role: { rich_text: [{ text: { content: "Approves or escalates" } }] },
        "Trigger Event": { rich_text: [{ text: { content: "Intake Agent completed" } }] },
        "HITL Exception Rule": { rich_text: [{ text: { content: "" } }] },
        "Upstream Agent": { relation: [{ id: "agent-0" }] },
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/notion/agents.test.ts`
Expected: FAIL — `Cannot find module './agents'`.

- [ ] **Step 3: Implement `lib/notion/agents.ts`**

```ts
import { getNotionClient } from "./client";
import { notionConfig } from "./config";

export interface AgentRecord {
  id: string;
  processId: string;
  agentName: string;
  role: string;
  triggerEvent: string;
  upstreamAgentId: string;
  hitlExceptionRule: string;
}

function pageToAgent(page: any): AgentRecord {
  const props = page.properties;
  return {
    id: page.id,
    processId: props.Process?.relation?.[0]?.id ?? "",
    agentName: props["Agent Name"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
    role: props.Role?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
    triggerEvent:
      props["Trigger Event"]?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
    upstreamAgentId: props["Upstream Agent"]?.relation?.[0]?.id ?? "",
    hitlExceptionRule:
      props["HITL Exception Rule"]?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
  };
}

export async function listAgentsForProcess(processId: string): Promise<AgentRecord[]> {
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: notionConfig.agentBlueprintDbId,
    filter: { property: "Process", relation: { contains: processId } },
  });
  return response.results.map(pageToAgent);
}

export async function createAgent(input: {
  processId: string;
  agentName: string;
  role: string;
  triggerEvent: string;
  upstreamAgentId: string;
  hitlExceptionRule: string;
}): Promise<AgentRecord> {
  const notion = getNotionClient();
  const properties: Record<string, any> = {
    "Agent Name": { title: [{ text: { content: input.agentName } }] },
    Process: { relation: [{ id: input.processId }] },
    Role: { rich_text: [{ text: { content: input.role } }] },
    "Trigger Event": { rich_text: [{ text: { content: input.triggerEvent } }] },
    "HITL Exception Rule": { rich_text: [{ text: { content: input.hitlExceptionRule } }] },
  };
  if (input.upstreamAgentId) {
    properties["Upstream Agent"] = { relation: [{ id: input.upstreamAgentId }] };
  }
  const page = await notion.pages.create({
    parent: { database_id: notionConfig.agentBlueprintDbId },
    properties,
  });
  return pageToAgent(page);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/notion/agents.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notion/agents.ts lib/notion/agents.test.ts
git commit -m "feat: add Notion-backed Agent Blueprint data access"
```

---

### Task 3: Agent orchestration chain logic

**Files:**
- Create: `lib/orchestration.ts`
- Create: `lib/orchestration.test.ts`

**Interfaces:**
- Consumes: `AgentRecord` (Task 2, type-only import).
- Produces: `buildAgentChain(agents: AgentRecord[]): AgentRecord[]` from `lib/orchestration.ts`, consumed by Task 5 (`AgentFlowDiagram.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `lib/orchestration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildAgentChain } from "./orchestration";
import type { AgentRecord } from "./notion/agents";

function makeAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: "a1",
    processId: "p1",
    agentName: "Agent",
    role: "",
    triggerEvent: "",
    upstreamAgentId: "",
    hitlExceptionRule: "",
    ...overrides,
  };
}

describe("buildAgentChain", () => {
  it("returns an empty array for no agents", () => {
    expect(buildAgentChain([])).toEqual([]);
  });

  it("orders a simple linear chain from root to leaf, regardless of input order", () => {
    const a = makeAgent({ id: "a", agentName: "A", upstreamAgentId: "" });
    const b = makeAgent({ id: "b", agentName: "B", upstreamAgentId: "a" });
    const c = makeAgent({ id: "c", agentName: "C", upstreamAgentId: "b" });
    const result = buildAgentChain([c, a, b]);
    expect(result.map((agent) => agent.id)).toEqual(["a", "b", "c"]);
  });

  it("concatenates multiple independent root chains", () => {
    const a = makeAgent({ id: "a", upstreamAgentId: "" });
    const b = makeAgent({ id: "b", upstreamAgentId: "a" });
    const x = makeAgent({ id: "x", upstreamAgentId: "" });
    const result = buildAgentChain([a, b, x]);
    expect(result.map((agent) => agent.id)).toEqual(["a", "b", "x"]);
  });

  it("treats an upstreamAgentId pointing outside the list as a root", () => {
    const a = makeAgent({ id: "a", upstreamAgentId: "missing" });
    const result = buildAgentChain([a]);
    expect(result.map((agent) => agent.id)).toEqual(["a"]);
  });

  it("does not infinite-loop on a cycle and still includes every agent exactly once", () => {
    const a = makeAgent({ id: "a", upstreamAgentId: "b" });
    const b = makeAgent({ id: "b", upstreamAgentId: "a" });
    const result = buildAgentChain([a, b]);
    expect(result.map((agent) => agent.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/orchestration.test.ts`
Expected: FAIL — `Cannot find module './orchestration'`.

- [ ] **Step 3: Implement `lib/orchestration.ts`**

```ts
import type { AgentRecord } from "./notion/agents";

export function buildAgentChain(agents: AgentRecord[]): AgentRecord[] {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const childByUpstream = new Map<string, AgentRecord>();
  for (const agent of agents) {
    if (agent.upstreamAgentId && byId.has(agent.upstreamAgentId)) {
      childByUpstream.set(agent.upstreamAgentId, agent);
    }
  }

  const roots = agents.filter(
    (agent) => !agent.upstreamAgentId || !byId.has(agent.upstreamAgentId)
  );

  const ordered: AgentRecord[] = [];
  const visited = new Set<string>();

  for (const root of roots) {
    let current: AgentRecord | undefined = root;
    while (current && !visited.has(current.id)) {
      ordered.push(current);
      visited.add(current.id);
      current = childByUpstream.get(current.id);
    }
  }

  for (const agent of agents) {
    if (!visited.has(agent.id)) {
      ordered.push(agent);
    }
  }

  return ordered;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/orchestration.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify the whole project still type-checks**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/orchestration.ts lib/orchestration.test.ts
git commit -m "feat: add agent orchestration chain ordering logic"
```

---

### Task 4: Agents API route

**Files:**
- Create: `app/api/agents/route.ts`

**Interfaces:**
- Consumes: `listAgentsForProcess`, `createAgent` (Task 2).
- Produces: `GET /api/agents?processId=` (200 with agents array, or error), `POST /api/agents` (201 with the created agent, or error).

- [ ] **Step 1: Implement `app/api/agents/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createAgent, listAgentsForProcess } from "@/lib/notion/agents";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");
  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  try {
    const agents = await listAgentsForProcess(processId);
    return NextResponse.json(agents);
  } catch {
    return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.processId || !body.agentName) {
    return NextResponse.json(
      { error: "processId and agentName are required" },
      { status: 400 }
    );
  }
  try {
    const agent = await createAgent({
      processId: body.processId,
      agentName: body.agentName,
      role: body.role ?? "",
      triggerEvent: body.triggerEvent ?? "",
      upstreamAgentId: body.upstreamAgentId ?? "",
      hitlExceptionRule: body.hitlExceptionRule ?? "",
    });
    return NextResponse.json(agent, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add agent" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors. (Route logic is a thin wrapper over already-tested `lib/notion/agents.ts` functions — covered end-to-end manually in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add app/api/agents/route.ts
git commit -m "feat: add Agents API route"
```

---

### Task 5: Agent flow diagram

**Files:**
- Create: `components/AgentFlowDiagram.tsx`

**Interfaces:**
- Consumes: `AgentRecord` (Task 2), `buildAgentChain` (Task 3).
- Produces: `AgentFlowDiagram({ agents }: { agents: AgentRecord[] })` component, consumed by Task 7. This is a plain presentational component with no hooks — do NOT add a `"use client"` directive; it renders fine as a Server Component, same as `BaselineSummary.tsx` from Plan 1.

- [ ] **Step 1: Implement `components/AgentFlowDiagram.tsx`**

```tsx
import { buildAgentChain } from "@/lib/orchestration";
import type { AgentRecord } from "@/lib/notion/agents";

export function AgentFlowDiagram({ agents }: { agents: AgentRecord[] }) {
  const chain = buildAgentChain(agents);

  if (chain.length === 0) {
    return (
      <p className="mb-6 text-sm text-slate-500">
        Add an agent below to see the orchestration flow.
      </p>
    );
  }

  return (
    <div className="mb-6 flex items-start gap-2 overflow-x-auto pb-4">
      {chain.map((agent, index) => (
        <div key={agent.id} className="flex shrink-0 items-center gap-2">
          <div
            className={`w-48 shrink-0 rounded border p-3 text-sm ${
              agent.hitlExceptionRule
                ? "border-red-400 bg-red-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="font-medium">{agent.agentName}</p>
            <p className="text-xs text-slate-500">{agent.role}</p>
            <p className="mt-1 text-xs text-slate-400">Trigger: {agent.triggerEvent}</p>
            {agent.hitlExceptionRule && (
              <p className="mt-1 text-xs font-medium text-red-600">
                HITL: {agent.hitlExceptionRule}
              </p>
            )}
          </div>
          {index < chain.length - 1 && (
            <span className="shrink-0 text-xl text-slate-400">&rarr;</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AgentFlowDiagram.tsx
git commit -m "feat: add agent orchestration flow diagram"
```

---

### Task 6: Agent form

**Files:**
- Create: `components/AgentForm.tsx`

**Interfaces:**
- Consumes: `AgentRecord` (Task 2), `POST /api/agents` (Task 4).
- Produces: `AgentForm({ processId, agents }: { processId: string; agents: AgentRecord[] })` component, consumed by Task 7. `agents` is used to populate the "Upstream Agent" dropdown with the process's existing agents.

- [ ] **Step 1: Implement `components/AgentForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentRecord } from "@/lib/notion/agents";

export function AgentForm({
  processId,
  agents,
}: {
  processId: string;
  agents: AgentRecord[];
}) {
  const router = useRouter();
  const [agentName, setAgentName] = useState("");
  const [role, setRole] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("");
  const [upstreamAgentId, setUpstreamAgentId] = useState("");
  const [hitlExceptionRule, setHitlExceptionRule] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          agentName,
          role,
          triggerEvent,
          upstreamAgentId,
          hitlExceptionRule,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Failed to add agent");
        return;
      }
      setAgentName("");
      setRole("");
      setTriggerEvent("");
      setUpstreamAgentId("");
      setHitlExceptionRule("");
      router.refresh();
    } catch {
      setError("Failed to add agent");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-slate-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500">Agent Name</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Role</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Trigger Event</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={triggerEvent}
            onChange={(e) => setTriggerEvent(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Upstream Agent</label>
          <select
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={upstreamAgentId}
            onChange={(e) => setUpstreamAgentId(e.target.value)}
          >
            <option value="">None (starts the flow)</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.agentName}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-slate-500">HITL Exception Rule (optional)</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={hitlExceptionRule}
            onChange={(e) => setHitlExceptionRule(e.target.value)}
            placeholder="e.g. Escalate to human if confidence < 80%"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {submitting ? "Adding..." : "Add Agent"}
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
git add components/AgentForm.tsx
git commit -m "feat: add agent blueprint form"
```

---

### Task 7: Phase 3 page

**Files:**
- Create: `app/process/[id]/phase3/page.tsx`

**Interfaces:**
- Consumes: `PhaseTabs` (`components/PhaseTabs.tsx`), `AgentFlowDiagram` (Task 5), `AgentForm` (Task 6), `listAgentsForProcess` (Task 2).
- Produces: fully working Phase 3 tab at `/process/[id]/phase3`.

- [ ] **Step 1: Implement `app/process/[id]/phase3/page.tsx`**

```tsx
import { PhaseTabs } from "@/components/PhaseTabs";
import { AgentFlowDiagram } from "@/components/AgentFlowDiagram";
import { AgentForm } from "@/components/AgentForm";
import { listAgentsForProcess, type AgentRecord } from "@/lib/notion/agents";

export const revalidate = 10;

export default async function Phase3Page({ params }: { params: { id: string } }) {
  let agents: AgentRecord[] = [];
  let error: string | null = null;
  try {
    agents = await listAgentsForProcess(params.id);
  } catch {
    error = "Failed to load agent blueprint. Please try again.";
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <PhaseTabs processId={params.id} activePhase={3} />
      <h2 className="mb-4 text-lg font-semibold">
        Reimagined Process and Agentic Orchestration Design
      </h2>
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </p>
      ) : (
        <>
          <AgentFlowDiagram agents={agents} />
          <AgentForm processId={params.id} agents={agents} />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (client, config, processes, steps, scoring, suitability, orchestration, agents).

- [ ] **Step 3: Manually verify the full end-to-end flow (controller/user, once `NOTION_AGENT_BLUEPRINT_DB_ID` is live — see Task 1 Step 8)**

1. Open an existing process with at least one step.
2. Click the "Phase 3: Architecture" tab.
3. Confirm the empty-state message shows ("Add an agent below...").
4. Add a first agent (e.g. "Intake Agent") with no Upstream Agent selected. Confirm it appears in the flow diagram as a single box.
5. Add a second agent (e.g. "Approval Agent") with Upstream Agent set to "Intake Agent", and an HITL Exception Rule filled in (e.g. "Escalate if confidence < 80%").
6. Confirm the flow diagram now shows two boxes connected by an arrow, in the correct order (Intake Agent → Approval Agent), and the second box is visually flagged (red border, HITL text shown).
7. Reload the page — confirm both agents and the diagram persist.

Expected: all values match manual entry; no console errors; diagram renders without crashing.

- [ ] **Step 4: Commit**

```bash
git add "app/process/[id]/phase3/page.tsx"
git commit -m "feat: add Phase 3 agentic orchestration UI"
```
