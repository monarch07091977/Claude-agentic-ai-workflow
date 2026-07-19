# Foundation + Phase 1 (Process Deconstruction) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js/Notion scaffold and deliver a working end-to-end slice: create a process, log its steps, and see the auto-computed baseline map (cycle time, cost, bottleneck count).

**Architecture:** Next.js (App Router, TypeScript) reading/writing Notion directly via `@notionhq/client`. Server Components read with short time-based revalidation; Route Handlers perform writes. Notion is the only data store — no local database.

**Tech Stack:** Next.js 14, React 18, TypeScript 5, Tailwind CSS, `@notionhq/client`, Vitest for unit tests, `tsx` for running one-off scripts.

## Global Constraints

- Data store is Notion only — no separate database (spec: Architecture).
- Notion integration token lives server-side only, via `NOTION_TOKEN` env var, never sent to the client (spec: Architecture, Non-goals).
- No user login/auth in v1 (spec: Non-goals).
- Reads use Server Components with short revalidation caching; writes go through Route Handlers directly to Notion (spec: Architecture).
- No AI-generated content in v1 — this is structured data entry and computed rollups only (spec: Non-goals).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `next-env.d.ts`
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `.env.local.example`
- Create: `.gitignore`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: a working `npm install` / `npx tsc --noEmit` baseline that every later task builds on. No exported functions.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "agentic-workflow-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "setup:notion": "tsx scripts/setup-notion.ts"
  },
  "dependencies": {
    "@notionhq/client": "^2.2.15",
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.9",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.5",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.4",
    "tsx": "^4.16.2",
    "typescript": "^5.5.3",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 4: Create `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

- [ ] **Step 5: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 7: Create `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Create `app/layout.tsx`**

```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Agentic Workflow Framework",
  description: "Turn legacy processes into agentic workflows",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create `.env.local.example`**

```
NOTION_TOKEN=secret_xxx
NOTION_PARENT_PAGE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_PROCESSES_DB_ID=
NOTION_STEPS_DB_ID=
```

- [ ] **Step 10: Create `.gitignore`**

```
node_modules/
.next/
.env.local
*.tsbuildinfo
```

- [ ] **Step 11: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 12: Install dependencies**

Run: `npm install`
Expected: exits 0, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 13: Verify the scaffold type-checks**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs next-env.d.ts app/globals.css app/layout.tsx .env.local.example .gitignore vitest.config.ts
git commit -m "chore: scaffold Next.js + TypeScript + Tailwind + Vitest project"
```

---

### Task 2: Notion client and config modules

**Files:**
- Create: `lib/notion/client.ts`
- Create: `lib/notion/client.test.ts`
- Create: `lib/notion/config.ts`
- Create: `lib/notion/config.test.ts`

**Interfaces:**
- Consumes: `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`, `NOTION_PROCESSES_DB_ID`, `NOTION_STEPS_DB_ID` env vars (Task 1's `.env.local.example`).
- Produces: `getNotionClient(): Client` from `lib/notion/client.ts`. `notionConfig: { parentPageId: string; processesDbId: string; stepsDbId: string }` (getters, throw if env var unset) from `lib/notion/config.ts`.

- [ ] **Step 1: Write the failing test for `getNotionClient`**

Create `lib/notion/client.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { getNotionClient } from "./client";

describe("getNotionClient", () => {
  afterEach(() => {
    delete process.env.NOTION_TOKEN;
  });

  it("throws when NOTION_TOKEN is not set", () => {
    delete process.env.NOTION_TOKEN;
    expect(() => getNotionClient()).toThrow(
      "NOTION_TOKEN environment variable is not set"
    );
  });

  it("returns a Notion client when NOTION_TOKEN is set", () => {
    process.env.NOTION_TOKEN = "secret_test";
    expect(getNotionClient()).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notion/client.test.ts`
Expected: FAIL — `Cannot find module './client'` (file does not exist yet).

- [ ] **Step 3: Implement `lib/notion/client.ts`**

```ts
import { Client } from "@notionhq/client";

let client: Client | null = null;

export function getNotionClient(): Client {
  if (!client) {
    const token = process.env.NOTION_TOKEN;
    if (!token) {
      throw new Error("NOTION_TOKEN environment variable is not set");
    }
    client = new Client({ auth: token });
  }
  return client;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/notion/client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing test for `notionConfig`**

Create `lib/notion/config.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { notionConfig } from "./config";

describe("notionConfig", () => {
  afterEach(() => {
    delete process.env.NOTION_PARENT_PAGE_ID;
    delete process.env.NOTION_PROCESSES_DB_ID;
    delete process.env.NOTION_STEPS_DB_ID;
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

  it("exposes processesDbId and stepsDbId the same way", () => {
    process.env.NOTION_PROCESSES_DB_ID = "processes-db";
    process.env.NOTION_STEPS_DB_ID = "steps-db";
    expect(notionConfig.processesDbId).toBe("processes-db");
    expect(notionConfig.stepsDbId).toBe("steps-db");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run lib/notion/config.test.ts`
Expected: FAIL — `Cannot find module './config'`.

- [ ] **Step 7: Implement `lib/notion/config.ts`**

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
};
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run lib/notion/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add lib/notion/client.ts lib/notion/client.test.ts lib/notion/config.ts lib/notion/config.test.ts
git commit -m "feat: add Notion client and env config modules"
```

---

### Task 3: Notion database schema setup script

**Files:**
- Create: `scripts/setup-notion.ts`

**Interfaces:**
- Consumes: `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID` env vars.
- Produces: two live Notion databases ("Processes", "Process Steps") with a `Process`/`Steps` relation and rollup properties on Processes (`Total Cycle Time (hrs)`, `Total Cost`, `Bottleneck Count`). Prints their IDs for the engineer to paste into `.env.local` as `NOTION_PROCESSES_DB_ID` / `NOTION_STEPS_DB_ID`. This is a one-time infra script, not covered by unit tests — verified manually against a real Notion workspace.

- [ ] **Step 1: Implement `scripts/setup-notion.ts`**

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

  console.log("Notion setup complete. Add these to your .env.local:\n");
  console.log(`NOTION_PROCESSES_DB_ID=${processesDb.id}`);
  console.log(`NOTION_STEPS_DB_ID=${stepsDb.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Create a Notion integration and share a parent page with it**

Manual (one-time, in the Notion UI):
1. Go to `https://www.notion.so/my-integrations`, create a new internal integration, copy its secret.
2. In Notion, create (or pick) a page to hold this app's databases, click "..." → "Connections" → add the integration.
3. Copy the page ID from its URL (the 32-character hex string after the last `-`).

- [ ] **Step 3: Set env vars and run the script**

```bash
cp .env.local.example .env.local
# edit .env.local: set NOTION_TOKEN and NOTION_PARENT_PAGE_ID from Step 2
export $(grep -E '^(NOTION_TOKEN|NOTION_PARENT_PAGE_ID)=' .env.local | xargs)
npm run setup:notion
```

Expected output: `Notion setup complete...` followed by two database IDs.

- [ ] **Step 4: Verify in Notion**

Manual: open the parent page in Notion. Confirm two databases exist — "Processes" (with a `Steps` relation column and `Total Cycle Time (hrs)` / `Total Cost` / `Bottleneck Count` rollup columns) and "Process Steps" (with a `Process` relation column).

- [ ] **Step 5: Add the database IDs to `.env.local`**

Manual: paste the two IDs printed in Step 3 into `.env.local` as `NOTION_PROCESSES_DB_ID` and `NOTION_STEPS_DB_ID`.

- [ ] **Step 6: Commit**

```bash
git add scripts/setup-notion.ts
git commit -m "feat: add one-time Notion database schema setup script"
```

---

### Task 4: Processes data access (`lib/notion/processes.ts`)

**Files:**
- Create: `lib/notion/processes.ts`
- Create: `lib/notion/processes.test.ts`

**Interfaces:**
- Consumes: `getNotionClient()` (Task 2), `notionConfig.processesDbId` (Task 2).
- Produces: `interface ProcessRecord { id: string; name: string; description: string; owner: string; status: string; currentPhase: string; totalCycleTimeHours: number }`, `listProcesses(): Promise<ProcessRecord[]>`, `createProcess(input: { name: string; description: string; owner: string }): Promise<ProcessRecord>` from `lib/notion/processes.ts`.

- [ ] **Step 1: Write the failing tests**

Create `lib/notion/processes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listProcesses, createProcess } from "./processes";

const queryMock = vi.fn();
const createMock = vi.fn();

vi.mock("./client", () => ({
  getNotionClient: () => ({
    databases: { query: queryMock },
    pages: { create: createMock },
  }),
}));

vi.mock("./config", () => ({
  notionConfig: { processesDbId: "test-db-id" },
}));

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "page-1",
    properties: {
      Name: { title: [{ plain_text: "Requisition to Pay" }] },
      Description: { rich_text: [{ plain_text: "P2P process" }] },
      Owner: { rich_text: [{ plain_text: "Jane Doe" }] },
      Status: { select: { name: "In Progress" } },
      "Current Phase": { select: { name: "2" } },
      "Total Cycle Time (hrs)": { rollup: { type: "number", number: 12.5 } },
      ...overrides,
    },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  createMock.mockReset();
});

describe("listProcesses", () => {
  it("maps Notion pages to ProcessRecord objects", async () => {
    queryMock.mockResolvedValue({ results: [makePage()] });
    const result = await listProcesses();
    expect(result).toEqual([
      {
        id: "page-1",
        name: "Requisition to Pay",
        description: "P2P process",
        owner: "Jane Doe",
        status: "In Progress",
        currentPhase: "2",
        totalCycleTimeHours: 12.5,
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith({ database_id: "test-db-id" });
  });
});

describe("createProcess", () => {
  it("creates a page with default status and phase", async () => {
    createMock.mockResolvedValue(
      makePage({
        Status: { select: { name: "Not Started" } },
        "Current Phase": { select: { name: "1" } },
        "Total Cycle Time (hrs)": { rollup: { type: "number", number: 0 } },
      })
    );
    const result = await createProcess({
      name: "Requisition to Pay",
      description: "P2P process",
      owner: "Jane Doe",
    });
    expect(result.status).toBe("Not Started");
    expect(result.totalCycleTimeHours).toBe(0);
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "test-db-id" },
      properties: {
        Name: { title: [{ text: { content: "Requisition to Pay" } }] },
        Description: { rich_text: [{ text: { content: "P2P process" } }] },
        Owner: { rich_text: [{ text: { content: "Jane Doe" } }] },
        Status: { select: { name: "Not Started" } },
        "Current Phase": { select: { name: "1" } },
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/notion/processes.test.ts`
Expected: FAIL — `Cannot find module './processes'`.

- [ ] **Step 3: Implement `lib/notion/processes.ts`**

```ts
import { getNotionClient } from "./client";
import { notionConfig } from "./config";

export interface ProcessRecord {
  id: string;
  name: string;
  description: string;
  owner: string;
  status: string;
  currentPhase: string;
  totalCycleTimeHours: number;
}

function pageToProcess(page: any): ProcessRecord {
  const props = page.properties;
  return {
    id: page.id,
    name: props.Name.title.map((t: any) => t.plain_text).join(""),
    description: props.Description.rich_text.map((t: any) => t.plain_text).join(""),
    owner: props.Owner.rich_text.map((t: any) => t.plain_text).join(""),
    status: props.Status.select?.name ?? "Not Started",
    currentPhase: props["Current Phase"].select?.name ?? "1",
    totalCycleTimeHours: props["Total Cycle Time (hrs)"]?.rollup?.number ?? 0,
  };
}

export async function listProcesses(): Promise<ProcessRecord[]> {
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: notionConfig.processesDbId,
  });
  return response.results.map(pageToProcess);
}

export async function createProcess(input: {
  name: string;
  description: string;
  owner: string;
}): Promise<ProcessRecord> {
  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: { database_id: notionConfig.processesDbId },
    properties: {
      Name: { title: [{ text: { content: input.name } }] },
      Description: { rich_text: [{ text: { content: input.description } }] },
      Owner: { rich_text: [{ text: { content: input.owner } }] },
      Status: { select: { name: "Not Started" } },
      "Current Phase": { select: { name: "1" } },
    },
  });
  return pageToProcess(page);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/notion/processes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notion/processes.ts lib/notion/processes.test.ts
git commit -m "feat: add Notion-backed Processes data access"
```

---

### Task 5: Process Steps data access (`lib/notion/steps.ts`)

**Files:**
- Create: `lib/notion/steps.ts`
- Create: `lib/notion/steps.test.ts`

**Interfaces:**
- Consumes: `getNotionClient()`, `notionConfig.stepsDbId` (Task 2).
- Produces: `interface StepRecord { id: string; processId: string; stepName: string; sequence: number; handoffType: string; cycleTimeHours: number; cost: number; bottleneck: boolean; notes: string }`, `listStepsForProcess(processId: string): Promise<StepRecord[]>`, `createStep(input): Promise<StepRecord>`, `updateStep(id: string, input: Partial<...>): Promise<StepRecord>`, `deleteStep(id: string): Promise<void>` from `lib/notion/steps.ts`.

- [ ] **Step 1: Write the failing tests**

Create `lib/notion/steps.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listStepsForProcess, createStep, updateStep, deleteStep } from "./steps";

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
  notionConfig: { stepsDbId: "steps-db-id" },
}));

function makeStepPage(overrides: Record<string, unknown> = {}) {
  return {
    id: "step-1",
    properties: {
      "Step Name": { title: [{ plain_text: "Submit Requisition" }] },
      Process: { relation: [{ id: "process-1" }] },
      Sequence: { number: 1 },
      "Handoff Type": { select: { name: "Human" } },
      "Cycle Time (hrs)": { number: 4 },
      Cost: { number: 100 },
      Bottleneck: { checkbox: true },
      Notes: { rich_text: [{ plain_text: "Manual approval" }] },
      ...overrides,
    },
  };
}

beforeEach(() => {
  queryMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
});

describe("listStepsForProcess", () => {
  it("queries steps filtered by process and sorted by sequence", async () => {
    queryMock.mockResolvedValue({ results: [makeStepPage()] });
    const result = await listStepsForProcess("process-1");
    expect(result).toEqual([
      {
        id: "step-1",
        processId: "process-1",
        stepName: "Submit Requisition",
        sequence: 1,
        handoffType: "Human",
        cycleTimeHours: 4,
        cost: 100,
        bottleneck: true,
        notes: "Manual approval",
      },
    ]);
    expect(queryMock).toHaveBeenCalledWith({
      database_id: "steps-db-id",
      filter: { property: "Process", relation: { contains: "process-1" } },
      sorts: [{ property: "Sequence", direction: "ascending" }],
    });
  });
});

describe("createStep", () => {
  it("creates a step page with the given properties", async () => {
    createMock.mockResolvedValue(makeStepPage());
    const result = await createStep({
      processId: "process-1",
      stepName: "Submit Requisition",
      sequence: 1,
      handoffType: "Human",
      cycleTimeHours: 4,
      cost: 100,
      bottleneck: true,
      notes: "Manual approval",
    });
    expect(result.stepName).toBe("Submit Requisition");
    expect(createMock).toHaveBeenCalledWith({
      parent: { database_id: "steps-db-id" },
      properties: {
        "Step Name": { title: [{ text: { content: "Submit Requisition" } }] },
        Process: { relation: [{ id: "process-1" }] },
        Sequence: { number: 1 },
        "Handoff Type": { select: { name: "Human" } },
        "Cycle Time (hrs)": { number: 4 },
        Cost: { number: 100 },
        Bottleneck: { checkbox: true },
        Notes: { rich_text: [{ text: { content: "Manual approval" } }] },
      },
    });
  });
});

describe("updateStep", () => {
  it("only sends properties that were provided", async () => {
    updateMock.mockResolvedValue(makeStepPage({ Bottleneck: { checkbox: false } }));
    await updateStep("step-1", { bottleneck: false });
    expect(updateMock).toHaveBeenCalledWith({
      page_id: "step-1",
      properties: { Bottleneck: { checkbox: false } },
    });
  });
});

describe("deleteStep", () => {
  it("archives the page", async () => {
    updateMock.mockResolvedValue(makeStepPage());
    await deleteStep("step-1");
    expect(updateMock).toHaveBeenCalledWith({ page_id: "step-1", archived: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/notion/steps.test.ts`
Expected: FAIL — `Cannot find module './steps'`.

- [ ] **Step 3: Implement `lib/notion/steps.ts`**

```ts
import { getNotionClient } from "./client";
import { notionConfig } from "./config";

export interface StepRecord {
  id: string;
  processId: string;
  stepName: string;
  sequence: number;
  handoffType: string;
  cycleTimeHours: number;
  cost: number;
  bottleneck: boolean;
  notes: string;
}

function pageToStep(page: any): StepRecord {
  const props = page.properties;
  return {
    id: page.id,
    processId: props.Process.relation[0]?.id ?? "",
    stepName: props["Step Name"].title.map((t: any) => t.plain_text).join(""),
    sequence: props.Sequence.number ?? 0,
    handoffType: props["Handoff Type"].select?.name ?? "System",
    cycleTimeHours: props["Cycle Time (hrs)"].number ?? 0,
    cost: props.Cost.number ?? 0,
    bottleneck: props.Bottleneck.checkbox,
    notes: props.Notes.rich_text.map((t: any) => t.plain_text).join(""),
  };
}

export async function listStepsForProcess(processId: string): Promise<StepRecord[]> {
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: notionConfig.stepsDbId,
    filter: { property: "Process", relation: { contains: processId } },
    sorts: [{ property: "Sequence", direction: "ascending" }],
  });
  return response.results.map(pageToStep);
}

export async function createStep(input: {
  processId: string;
  stepName: string;
  sequence: number;
  handoffType: string;
  cycleTimeHours: number;
  cost: number;
  bottleneck: boolean;
  notes: string;
}): Promise<StepRecord> {
  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: { database_id: notionConfig.stepsDbId },
    properties: {
      "Step Name": { title: [{ text: { content: input.stepName } }] },
      Process: { relation: [{ id: input.processId }] },
      Sequence: { number: input.sequence },
      "Handoff Type": { select: { name: input.handoffType } },
      "Cycle Time (hrs)": { number: input.cycleTimeHours },
      Cost: { number: input.cost },
      Bottleneck: { checkbox: input.bottleneck },
      Notes: { rich_text: [{ text: { content: input.notes } }] },
    },
  });
  return pageToStep(page);
}

export async function updateStep(
  id: string,
  input: Partial<{
    stepName: string;
    sequence: number;
    handoffType: string;
    cycleTimeHours: number;
    cost: number;
    bottleneck: boolean;
    notes: string;
  }>
): Promise<StepRecord> {
  const notion = getNotionClient();
  const properties: Record<string, unknown> = {};
  if (input.stepName !== undefined) {
    properties["Step Name"] = { title: [{ text: { content: input.stepName } }] };
  }
  if (input.sequence !== undefined) {
    properties.Sequence = { number: input.sequence };
  }
  if (input.handoffType !== undefined) {
    properties["Handoff Type"] = { select: { name: input.handoffType } };
  }
  if (input.cycleTimeHours !== undefined) {
    properties["Cycle Time (hrs)"] = { number: input.cycleTimeHours };
  }
  if (input.cost !== undefined) {
    properties.Cost = { number: input.cost };
  }
  if (input.bottleneck !== undefined) {
    properties.Bottleneck = { checkbox: input.bottleneck };
  }
  if (input.notes !== undefined) {
    properties.Notes = { rich_text: [{ text: { content: input.notes } }] };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return pageToStep(page);
}

export async function deleteStep(id: string): Promise<void> {
  const notion = getNotionClient();
  await notion.pages.update({ page_id: id, archived: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/notion/steps.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notion/steps.ts lib/notion/steps.test.ts
git commit -m "feat: add Notion-backed Process Steps data access"
```

---

### Task 6: Baseline aggregation (`lib/scoring.ts`)

**Files:**
- Create: `lib/scoring.ts`
- Create: `lib/scoring.test.ts`

**Interfaces:**
- Consumes: `StepRecord` (Task 5).
- Produces: `interface BaselineSummary { totalCycleTimeHours: number; totalCost: number; bottleneckCount: number }`, `computeBaselineSummary(steps: StepRecord[]): BaselineSummary` from `lib/scoring.ts`.

- [ ] **Step 1: Write the failing tests**

Create `lib/scoring.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeBaselineSummary } from "./scoring";
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/scoring.test.ts`
Expected: FAIL — `Cannot find module './scoring'`.

- [ ] **Step 3: Implement `lib/scoring.ts`**

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/scoring.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "feat: add baseline summary aggregation"
```

---

### Task 7: Portfolio dashboard and process creation

**Files:**
- Create: `app/api/processes/route.ts`
- Create: `app/page.tsx`
- Create: `app/process/new/page.tsx`

**Interfaces:**
- Consumes: `ProcessRecord`, `listProcesses`, `createProcess` (Task 4).
- Produces: `GET /api/processes`, `POST /api/processes` routes; `/` portfolio dashboard page; `/process/new` creation form page.

- [ ] **Step 1: Implement `app/api/processes/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createProcess, listProcesses } from "@/lib/notion/processes";

export async function GET() {
  const processes = await listProcesses();
  return NextResponse.json(processes);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const process = await createProcess({
    name: body.name,
    description: body.description ?? "",
    owner: body.owner ?? "",
  });
  return NextResponse.json(process, { status: 201 });
}
```

- [ ] **Step 2: Implement `app/page.tsx`**

```tsx
import Link from "next/link";
import { listProcesses } from "@/lib/notion/processes";

export const revalidate = 30;

export default async function PortfolioDashboard() {
  const processes = await listProcesses();

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Process Portfolio</h1>
        <Link
          href="/process/new"
          className="rounded bg-slate-900 px-4 py-2 text-white"
        >
          New Process
        </Link>
      </div>
      {processes.length === 0 ? (
        <p className="text-slate-500">No processes yet. Create one to get started.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200">
          {processes.map((process) => (
            <li key={process.id} className="p-4 hover:bg-slate-50">
              <Link href={`/process/${process.id}/phase1`} className="block">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{process.name}</span>
                  <span className="text-sm text-slate-500">
                    Phase {process.currentPhase} &middot; {process.status} &middot;{" "}
                    {process.totalCycleTimeHours} hrs total cycle time
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Implement `app/process/new/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProcessPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const response = await fetch("/api/processes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, owner }),
    });
    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Failed to create process");
      return;
    }
    const created = await response.json();
    router.push(`/process/${created.id}/phase1`);
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-semibold">New Process</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Owner</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-2"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Process"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: empty portfolio message shown; clicking "New Process", filling the form, and submitting redirects to `/process/<id>/phase1` (will 404 until Task 10 — that's expected at this point) and the process now shows on the dashboard when you navigate back to `/`.

- [ ] **Step 5: Commit**

```bash
git add app/api/processes/route.ts app/page.tsx app/process/new/page.tsx
git commit -m "feat: add portfolio dashboard and process creation flow"
```

---

### Task 8: Process workspace shell and phase tabs

**Files:**
- Create: `components/PhaseTabs.tsx`
- Create: `app/process/[id]/page.tsx`

**Interfaces:**
- Produces: `PhaseTabs({ processId: string; activePhase: number })` component from `components/PhaseTabs.tsx`; `/process/[id]` route that redirects to `/process/[id]/phase1`.

- [ ] **Step 1: Implement `components/PhaseTabs.tsx`**

```tsx
import Link from "next/link";

const PHASES = [
  { number: 1, label: "Deconstruction" },
  { number: 2, label: "Feasibility" },
  { number: 3, label: "Architecture" },
  { number: 4, label: "Value" },
] as const;

export function PhaseTabs({
  processId,
  activePhase,
}: {
  processId: string;
  activePhase: number;
}) {
  return (
    <nav className="mb-6 flex gap-2 border-b border-slate-200">
      {PHASES.map((phase) => (
        <Link
          key={phase.number}
          href={`/process/${processId}/phase${phase.number}`}
          className={`px-4 py-2 text-sm font-medium ${
            phase.number === activePhase
              ? "border-b-2 border-slate-900 text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Phase {phase.number}: {phase.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Implement `app/process/[id]/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default function ProcessRootPage({ params }: { params: { id: string } }) {
  redirect(`/process/${params.id}/phase1`);
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add components/PhaseTabs.tsx app/process/[id]/page.tsx
git commit -m "feat: add process workspace shell and phase tab navigation"
```

---

### Task 9: Process Steps API routes

**Files:**
- Create: `app/api/steps/route.ts`
- Create: `app/api/steps/[id]/route.ts`

**Interfaces:**
- Consumes: `StepRecord`, `listStepsForProcess`, `createStep`, `updateStep`, `deleteStep` (Task 5).
- Produces: `GET /api/steps?processId=`, `POST /api/steps`, `PATCH /api/steps/[id]`, `DELETE /api/steps/[id]` routes.

- [ ] **Step 1: Implement `app/api/steps/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createStep, listStepsForProcess } from "@/lib/notion/steps";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");
  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  const steps = await listStepsForProcess(processId);
  return NextResponse.json(steps);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.processId || !body.stepName) {
    return NextResponse.json(
      { error: "processId and stepName are required" },
      { status: 400 }
    );
  }
  const step = await createStep({
    processId: body.processId,
    stepName: body.stepName,
    sequence: body.sequence ?? 0,
    handoffType: body.handoffType ?? "System",
    cycleTimeHours: body.cycleTimeHours ?? 0,
    cost: body.cost ?? 0,
    bottleneck: body.bottleneck ?? false,
    notes: body.notes ?? "",
  });
  return NextResponse.json(step, { status: 201 });
}
```

- [ ] **Step 2: Implement `app/api/steps/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { deleteStep, updateStep } from "@/lib/notion/steps";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const step = await updateStep(params.id, body);
  return NextResponse.json(step);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await deleteStep(params.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors. (Route logic itself is a thin wrapper over the already-tested `lib/notion/steps.ts` functions — covered end-to-end manually in Task 10.)

- [ ] **Step 4: Commit**

```bash
git add app/api/steps/route.ts "app/api/steps/[id]/route.ts"
git commit -m "feat: add Process Steps API routes"
```

---

### Task 10: Phase 1 tab UI

**Files:**
- Create: `components/BaselineSummary.tsx`
- Create: `components/StepTable.tsx`
- Create: `app/process/[id]/phase1/page.tsx`

**Interfaces:**
- Consumes: `computeBaselineSummary` (Task 6), `StepRecord`, `listStepsForProcess` (Task 5), `PhaseTabs` (Task 8), `POST /api/steps` (Task 9).
- Produces: fully working Phase 1 tab at `/process/[id]/phase1`.

- [ ] **Step 1: Implement `components/BaselineSummary.tsx`**

```tsx
import { computeBaselineSummary } from "@/lib/scoring";
import type { StepRecord } from "@/lib/notion/steps";

export function BaselineSummary({ steps }: { steps: StepRecord[] }) {
  const summary = computeBaselineSummary(steps);
  return (
    <div className="mb-6 grid grid-cols-3 gap-4">
      <div className="rounded border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Total Cycle Time</p>
        <p className="text-xl font-semibold">{summary.totalCycleTimeHours} hrs</p>
      </div>
      <div className="rounded border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Total Cost</p>
        <p className="text-xl font-semibold">${summary.totalCost}</p>
      </div>
      <div className="rounded border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Bottlenecks</p>
        <p className="text-xl font-semibold">{summary.bottleneckCount}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `components/StepTable.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StepRecord } from "@/lib/notion/steps";

export function StepTable({
  processId,
  steps,
}: {
  processId: string;
  steps: StepRecord[];
}) {
  const router = useRouter();
  const [stepName, setStepName] = useState("");
  const [cycleTimeHours, setCycleTimeHours] = useState(0);
  const [cost, setCost] = useState(0);
  const [bottleneck, setBottleneck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddStep(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const response = await fetch("/api/steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        processId,
        stepName,
        sequence: steps.length + 1,
        cycleTimeHours,
        cost,
        bottleneck,
      }),
    });
    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Failed to add step");
      return;
    }
    setStepName("");
    setCycleTimeHours(0);
    setCost(0);
    setBottleneck(false);
    router.refresh();
  }

  return (
    <div>
      <table className="mb-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2">#</th>
            <th>Step</th>
            <th>Handoff</th>
            <th>Cycle Time (hrs)</th>
            <th>Cost</th>
            <th>Bottleneck</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.id} className="border-b border-slate-100">
              <td className="py-2">{step.sequence}</td>
              <td>{step.stepName}</td>
              <td>{step.handoffType}</td>
              <td>{step.cycleTimeHours}</td>
              <td>{step.cost}</td>
              <td>{step.bottleneck ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={handleAddStep} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500">Step name</label>
          <input
            className="rounded border border-slate-300 p-1"
            value={stepName}
            onChange={(e) => setStepName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Cycle time (hrs)</label>
          <input
            type="number"
            className="w-24 rounded border border-slate-300 p-1"
            value={cycleTimeHours}
            onChange={(e) => setCycleTimeHours(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Cost</label>
          <input
            type="number"
            className="w-24 rounded border border-slate-300 p-1"
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
          />
        </div>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={bottleneck}
            onChange={(e) => setBottleneck(e.target.checked)}
          />
          Bottleneck
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-50"
        >
          Add Step
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Implement `app/process/[id]/phase1/page.tsx`**

```tsx
import { PhaseTabs } from "@/components/PhaseTabs";
import { BaselineSummary } from "@/components/BaselineSummary";
import { StepTable } from "@/components/StepTable";
import { listStepsForProcess } from "@/lib/notion/steps";

export const revalidate = 10;

export default async function Phase1Page({ params }: { params: { id: string } }) {
  const steps = await listStepsForProcess(params.id);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <PhaseTabs processId={params.id} activePhase={1} />
      <h2 className="mb-4 text-lg font-semibold">Process Deconstruction</h2>
      <BaselineSummary steps={steps} />
      <StepTable processId={params.id} steps={steps} />
    </main>
  );
}
```

- [ ] **Step 4: Manually verify the full end-to-end flow**

Run: `npm run dev`, open `http://localhost:3000`.
1. Click "New Process", create a process (e.g. "Requisition to Pay").
2. On the Phase 1 tab, add 2-3 steps with different cycle times, costs, and bottleneck flags.
3. Confirm the Baseline Summary panel updates (total cycle time, total cost, bottleneck count match what you entered).
4. Navigate back to `/`, confirm the process's total cycle time shown matches.

Expected: all values match manual entry; no console errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (client, config, processes, steps, scoring).

- [ ] **Step 6: Commit**

```bash
git add components/BaselineSummary.tsx components/StepTable.tsx "app/process/[id]/phase1/page.tsx"
git commit -m "feat: add Phase 1 process deconstruction UI"
```
