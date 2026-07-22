# AI Assist Features — Design Spec

**Status:** Approved by user 2026-07-22, ready for implementation planning.

## Goal

Add real LLM capability to three points in the existing 4-phase workflow, where
today the consultant starts from a blank input every time:

1. **Phase 2** — suggest agentic-suitability scores for a step
2. **Phase 1** — draft a step list from pasted, unstructured process text
3. **Phase 3** — draft an agent blueprint from the steps already scored Agentic

This is additive only. Every existing manual-entry path keeps working exactly as
it does today; the AI paths are new, optional buttons next to them.

## Product rule (non-negotiable, applies to all three features)

**The model never writes to Notion.** Every AI response pre-fills the same
editable form fields the manual flow already uses. The consultant reviews (and
can edit) the suggestion, then clicks the same Save/Add Step/Import/Add Agent
action that exists today. This preserves two things the app already guarantees
everywhere else: Notion stays the single source of truth, and every record has
a human who chose to save it.

## Provider

Anthropic Claude, via the official `@anthropic-ai/sdk` Node package, called
server-side only (never exposed to the client). One new required environment
variable: `ANTHROPIC_API_KEY` — added to `.env.local.example`, `README.md`
(now 8 vars, all deploy paths), and `render.yaml`.

## Architecture

### `lib/ai/client.ts` (new)

A single exported function:

```ts
async function generateStructured<T>(params: {
  system: string;
  prompt: string;
  schema: object; // JSON Schema the model's response must match
}): Promise<T>
```

Internally calls the Anthropic Messages API with a forced tool-use call whose
input schema is `params.schema` — this is how we get back parseable JSON
instead of parsing free text out of a chat response. Throws on malformed
output (missing tool call, schema-invalid arguments) so the three route
handlers can each decide how to surface that as a normal error-JSON response,
consistent with the project's existing "every route returns JSON on every
path" convention.

This is the only file that imports `@anthropic-ai/sdk`. All prompt text and
JSON-schema shapes for the three features live in their own route files, not
in this shared client — `client.ts` stays a thin transport wrapper.

### Three new API routes

Each follows the codebase's existing route conventions: `try/catch` on every
path, JSON body on success and on error, no partial responses.

- `POST /api/ai/suggest-score` — **Feature 1**
  - Input: `{ stepId: string }`
  - Server loads the step (new `getStep(id)` added to `lib/notion/steps.ts`,
    since no single-record lookup exists there yet — every other read is
    `listStepsForProcess`), builds a prompt from its existing fields
    (`stepName`, `handoffType`, `cycleTimeHours`, `cost`, `bottleneck`,
    `notes`), and asks for `{ dataComplexity: 1-5, decisionLogic: 1-5,
    contextVolatility: 1-5, rationale: string }`.
  - **No new Notion schema field.** Steps already have a `notes` rich-text
    property (used by the spreadsheet importer) even though the manual
    add-step form in `StepTable` never exposed an input for it — the AI
    route reads it as free-text context when present. No schema change
    needed; this replaces the "add a Description field" open question from
    the original design discussion.

- `POST /api/ai/draft-steps` — **Feature 2**
  - Input: `{ rawText: string }`. No `processId` — extraction and validation
    don't touch Notion, so the route doesn't need it; the client already has
    it and supplies it separately when it later calls `POST /api/steps` for
    each confirmed row.
  - Prompts the model to extract a step list as
    `{ steps: { stepName, handoffType, cycleTimeHours, cost, bottleneck }[] }`
    matching the same shape `parseStepRows` in `lib/importSteps.ts` already
    validates.
  - The route runs the model's output through `parseStepRows` before
    returning it to the client — one validation source of truth shared with
    the spreadsheet importer, not a second copy of the same rules.
  - Response is a **preview list**, not a write. The client shows it in an
    editable table (same interaction shape as the existing import-preview
    step); on confirm, the client calls the existing `POST /api/steps`
    once per reviewed row, the same endpoint manual single-step entry
    already uses — no new bulk-write endpoint (see Out of scope).

- `POST /api/ai/draft-agents` — **Feature 3**
  - Input: `{ processId: string }`
  - Server loads steps + suitability scores (`listStepsForProcess`,
    `listSuitabilityScoresForSteps`, already existing), filters to steps
    where `classifySuitability(computeSuitabilityScore(...)) === "Agentic"`
    (reusing `lib/scoring.ts` as-is, no duplicated classification logic),
    and prompts for `{ agents: { agentName, role, triggerEvent,
    suggestedUpstreamAgentName: string | null, hitlExceptionRule: string |
    null, rationale: string }[] }` — ordering in the array is the suggested
    chain order.
  - Response is a **preview list** the consultant reviews. Each row saves
    through the existing `AgentForm` submit path (`POST /api/agents`) —
    reusing the exact endpoint and validation that manual agent entry
    already goes through, one row at a time, matching how the form works
    today. No new bulk-write endpoint.

### Client-side UX

- **Phase 2 (`SuitabilityForm`)**: a "Suggest" button per row. On click,
  calls `/api/ai/suggest-score`, fills the three number inputs with the
  response, shows the rationale as small helper text under the row. The
  consultant can still hand-edit any input before clicking the existing
  per-row Save.
- **Phase 1 (Phase 1 page / new component)**: a "Draft from text" section
  next to the existing "Import steps from a spreadsheet" box — a textarea +
  "Draft Steps" button. Result renders as an editable table (name, handoff
  type, cycle time, cost, bottleneck all editable inline); a "Add these
  steps" button commits the reviewed rows.
- **Phase 3 (`AgentForm` / Phase 3 page)**: a "Draft agent blueprint" button
  above the existing manual `AgentForm`. Result renders as a list of
  editable agent cards (same fields as `AgentForm`); each card has its own
  "Add" button that submits it through the same path a manually-filled
  `AgentForm` would.

## Error handling

- Missing/invalid `ANTHROPIC_API_KEY`, Anthropic API errors, timeouts, and
  schema-mismatched model output all surface as a normal `{ error: string }`
  JSON response with a non-2xx status — the client-side buttons show this
  inline exactly like every other mutating fetch in the app (try/catch/finally,
  visible error, button re-enabled).
- These are the app's first calls to an external API besides Notion. No
  retry logic beyond what the SDK does by default — a failed suggestion just
  means the consultant falls back to typing the value manually, which is
  already a fully-working path.

## Testing

- `lib/ai/client.ts`: unit tests with the Anthropic SDK mocked (same pattern
  as `getNotionClient` mocking) — verify it parses a well-formed tool-use
  response into the typed result, and throws on a missing/malformed tool
  call.
- Each route's prompt-building and response-shaping logic gets unit tests
  with `generateStructured` mocked — e.g., Feature 3's Agentic-only
  filtering logic is real, testable code independent of any live model call.
- No test suite call ever hits the real Anthropic API — consistent with the
  project's existing "no live Notion calls in tests" convention.
- UI components (buttons, preview tables) are verified manually in the
  browser preview, same as every other component in this project.

## Out of scope for this spec

- Streaming responses (all three calls are single-shot, low-latency enough
  for a blocking request).
- A shared "Notes" field on Process Steps (deferred, see Feature 1 above).
- Bulk-save endpoints for drafted steps/agents (both features commit through
  existing single-item endpoints for v1).
- Any client-side/browser use of the Anthropic API key — all calls are
  server-side only.
