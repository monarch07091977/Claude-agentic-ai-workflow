# Agentic Workflow Framework App — Design Spec

Date: 2026-07-19

## Purpose

A general-purpose, client-facing web app that operationalizes a 4-phase methodology for
turning legacy business processes into AI-agent-driven workflows:

1. **Process Deconstruction and Value Mapping** — map current-state handoffs, quantify
   cycle time, bottlenecks, and cost leaks.
2. **Cognitive Load and Automation Potential Assessment** — score each process step for
   agentic suitability (data complexity, decision logic, context volatility) and classify
   it as algorithmic, agentic, or human-required.
3. **Reimagined Process and Agentic Orchestration Design** — design the target-state
   multi-agent workflow, including trigger events, agent boundaries, and human-in-the-loop
   (HITL) exception points.
4. **Value Realization and Business Impact Measurement** — track baseline → current →
   target metrics (cycle time, cost, decision accuracy, human hours reallocated) as the
   redesigned workflow is rolled out.

The app supports a **portfolio** of processes (e.g. Requisition-to-Pay, Source-to-Procure,
Sourcing Management can each be tracked independently), each progressing through the 4
phases at its own pace.

## Non-goals (v1)

- No user login/auth — server-side Notion integration token only, app access controlled by
  URL/network.
- No AI-generated content — this is a structured data-entry and visualization tool, not an
  LLM-in-the-loop assistant. (Could be a future phase.)
- No real-time multi-user collaboration/presence beyond what Notion's own concurrent-edit
  handling provides.

## Architecture

- **Frontend/backend**: Next.js (App Router), TypeScript.
- **Data store**: Notion, accessed via the Notion API (server-side integration token, kept
  in an environment variable, never exposed to the client).
- **Read pattern**: Server Components query Notion at request time with a short
  revalidation window (time-based ISR-style caching) so the UI feels responsive without
  standing up a second database.
- **Write pattern**: Route Handlers (API routes) perform Notion API writes directly; no
  write-behind queue or local cache layer.
- **Hosting**: Vercel (or equivalent Next.js host). Not addressed further in this spec —
  deployment is a later step.

## Notion Data Model

All databases below live under one Notion page/workspace section for this app, connected
by relation properties.

### 1. Processes (the portfolio)
| Property | Type |
|---|---|
| Name | Title |
| Description | Text |
| Owner | Text |
| Status | Select (Not Started / In Progress / Complete) |
| Current Phase | Select (1–4) |
| Created | Created time |
| Updated | Last edited time |

### 2. Process Steps (Phase 1)
| Property | Type |
|---|---|
| Step Name | Title |
| Process | Relation → Processes |
| Sequence | Number |
| Handoff Type | Select (System / Human / Cross-team / External) |
| Cycle Time (hrs) | Number |
| Cost | Number |
| Bottleneck | Checkbox |
| Notes | Text |

Rollups on **Processes**: total cycle time, total cost, bottleneck count (sum/count over
related Process Steps).

### 3. Suitability Scores (Phase 2)
| Property | Type |
|---|---|
| Step | Relation → Process Steps (1:1) |
| Data Complexity | Number (1–5) |
| Decision Logic | Number (1–5) |
| Context Volatility | Number (1–5) |
| Suitability Score | Formula (computed from the three scores above) |
| Classification | Select (Algorithmic / Agentic / Human-required) |

### 4. Agent Blueprint (Phase 3)
| Property | Type |
|---|---|
| Agent Name | Title |
| Process | Relation → Processes |
| Role | Text |
| Trigger Event | Text |
| Upstream Agent | Relation → Agent Blueprint (self-relation) |
| HITL Exception Rule | Text |

### 5. Value Metrics (Phase 4)
| Property | Type |
|---|---|
| Metric Name | Title |
| Process | Relation → Processes |
| Category | Select (Cycle Time / Cost / Quality / Human Hours Reallocated) |
| Baseline | Number |
| Current | Number |
| Target | Number |
| Unit | Text |

## App Screens

- **Portfolio dashboard** (`/`) — table/card list of all Processes, showing phase progress
  and headline metric (e.g. current total cycle time).
- **Process workspace** (`/process/[id]`) — 4 tabs, one per phase:
  - **Phase 1 tab**: editable Process Steps table; auto-computed baseline summary panel
    (total cycle time, total leak cost, bottleneck count).
  - **Phase 2 tab**: scoring form per step (three 1–5 inputs) with live-computed
    Suitability Score and Classification; quadrant/scatter chart (complexity vs.
    volatility, point size = suitability, color = classification).
  - **Phase 3 tab**: Agent Blueprint list/editor with orchestration order; rendered as a
    simple flow diagram (nodes = agents, edges = trigger relationships), HITL points
    visually flagged.
  - **Phase 4 tab**: KPI cards (baseline → current → target per metric) + trend
    visualization; summary of hours reallocated / cost saved.

## Exports

- **PDF/PPTX**: server-generated via `pptxgenjs`, one slide per phase plus a summary
  slide, populated from the same Notion data used on-screen.
- **Excel**: `xlsx`-based export of the Suitability Matrix (Phase 2) and Value Metrics
  (Phase 4) tables.

## Error Handling

- Notion API failures (rate limit, network, auth) surface as an inline error banner on the
  affected screen/section; the rest of the UI stays usable.
- Writes are optimistic in the UI but roll back with a visible error if the underlying
  Notion write fails.
- No retry queue or offline mode in v1 — a failed write requires the user to retry the
  action.

## Testing

- Unit tests for pure logic: Suitability Score formula, baseline aggregation
  (cycle time/cost/bottleneck rollups), classification thresholds.
- Integration-style tests for Notion API read/write helpers using a mocked Notion client.
- Manual verification of PDF/PPTX/Excel exports against on-screen data for one sample
  process end-to-end.

## Setup Requirements

- A Notion integration token with access to the target workspace page.
- The 5 databases above created under that page (created during implementation via the
  Notion API/MCP tools) with relations wired between them.
- Environment variables for the Notion token and root page ID, configured in the Next.js
  deployment.
