# Phase 2 Scoring Questionnaire — Design Spec

**Status:** Approved by user 2026-07-23 (both open questions resolved), ready for implementation planning.

## Goal

Today's "Suggest" button (Phase 2) scores a step from thin metadata alone —
name, handoff type, cost, cycle time, an almost-always-empty notes field. It
can't tell whether a vaguely-named step like "Approve requisition" is a
rubber-stamp or a real judgment call.

Add a second, deeper path: **"Deep dive"** generates a small set of
step-specific questions aimed at the three scoring dimensions, the
consultant answers them in free text, then **"Score from answers"** scores
from those real answers instead of a guess. The existing one-click
"Suggest" stays as-is for steps that don't need the extra rigor.

## Decisions from the design discussion

- **Suggest and Deep dive coexist** — nothing removed. Deep dive is a new,
  optional, slower path next to the existing fast one.
- **Answers persist to Notion** as an audit trail of why a step was scored
  the way it was — a new `Assessment Q&A` rich-text property on the
  existing **Suitability Scores** database, written whenever the
  consultant saves a score for which any questionnaire answer exists
  (whether or not they used "Score from answers" to derive the final
  numbers, or typed them by hand after reading the questions).

## Architecture

### Notion schema change

One new rich-text property, `Assessment Q&A`, added to the **existing**
Suitability Scores database (already live, already holds real scored data
from testing this session). This is a property addition to an existing
database, not a new database — the codebase's existing
`findExistingDatabaseId`-based idempotency in `scripts/setup-notion.ts`
only *reuses* an already-found database ID, it does not backfill missing
properties onto it. `scripts/setup-notion.ts` needs one new, unconditional
`notion.databases.update(...)` call right after `suitabilityDbId` is
resolved (whether freshly created or reused) that ensures `Assessment
Q&A: { rich_text: {} }` exists — safe to run on every invocation, since
re-declaring an existing property with the same config is a no-op in the
Notion API.

### Data access (`lib/notion/suitability.ts`)

- `SuitabilityScoreRecord` gains `assessmentQA: string`.
- `pageToSuitabilityScore` reads it from `props["Assessment Q&A"]?.rich_text`.
- `upsertSuitabilityScore` takes an optional `assessmentQA?: string` and
  only includes the property in the Notion write when it's provided —
  saving a score the old way (no questionnaire ever run) must not
  overwrite a previously-recorded Q&A trail with blank text.

### API route (`app/api/suitability/route.ts`)

`POST` accepts an optional `assessmentQA: string` in the body alongside
the three existing required numbers, and passes it through unchanged.
This is the **only** write path for a suitability score — Deep dive still
never writes to Notion directly, exactly like Suggest today.

### Two new AI routes, following the exact shape every existing `lib/ai/*`
feature already uses (pure prompt/schema module → thin route)

- **`POST /api/ai/step-questions`** — input `{ stepId }`. Loads the step
  (`getStep`, already exists), asks Claude for exactly six questions —
  two per dimension (`dataComplexity`, `decisionLogic`,
  `contextVolatility`) — each one concrete and specific to *this* step's
  name/handoff type/notes, not boilerplate. Returns
  `{ questions: { dimension, question }[] }`.
- **`POST /api/ai/score-from-answers`** — input
  `{ stepId, answers: { dimension, question, answer }[] }`. Loads the
  step, builds a prompt combining the step's fields with the full Q&A
  transcript, and reuses the **exact same** response schema and
  `SuggestedScore` type `lib/ai/suggestScore.ts` already exports for the
  plain Suggest flow — same three 1–5 scores plus a rationale, just
  grounded in real answers instead of a guess. No duplicate schema.

### UI (`components/SuitabilityForm.tsx`)

- A "Deep dive" button joins the existing Suggest/Save pair in each row's
  action cell.
- Clicking it expands the row into an inline panel (a new fragment row,
  same pattern as the existing rationale row) showing the six questions
  grouped by dimension, each with a textarea for the answer.
- A "Score from answers" button in that panel calls
  `/api/ai/score-from-answers` and pre-fills the row's three number
  inputs plus the rationale — exactly like Suggest does today, just from
  richer grounding.
- The existing "Save" button (unchanged endpoint, unchanged validation)
  now also sends `assessmentQA` — a plain-text transcript built
  client-side from whatever questions/answers exist for that step at
  save time (formatted as repeated `Q (<dimension>): <question>\nA:
  <answer>` blocks) — whenever at least one answer is non-empty. If Deep
  dive was never opened for a step, `assessmentQA` is omitted entirely
  and the property is left untouched server-side, per the data-access
  rule above.

## Error handling

Both new routes follow the identical convention every existing route in
this project uses: JSON body on every path, try/catch around both body
parsing and the handler logic, generic error message on failure. Both new
client-side fetches (`handleDeepDive`, `handleScoreFromAnswers`) use
try/catch/finally exactly like `handleSuggest` does today.

## Testing

- `lib/notion/suitability.test.ts` (existing file, extended): new
  assertions for `assessmentQA` round-tripping through
  `pageToSuitabilityScore`, and that `upsertSuitabilityScore` omits the
  property from the Notion write when not provided vs. includes it when
  provided.
- `lib/ai/stepQuestions.ts` and `lib/ai/scoreFromAnswers.ts` each get a
  test file mirroring `lib/ai/suggestScore.test.ts`'s style — pure
  prompt-building functions tested without mocks.
- The two new routes are not separately unit-tested, consistent with
  every other AI route in this project (thin handlers, verified manually).
- No test ever hits the real Anthropic API or a real Notion workspace.

## Out of scope

- Editing or deleting a previously-saved Q&A trail from the UI (Notion
  itself remains the escape hatch, same as every other field in this app).
- Any change to the classification thresholds or scoring formula
  (`lib/scoring.ts` is untouched — Deep dive changes *how the inputs are
  arrived at*, never the math that turns them into a score).
- A dedicated Q&A history view (only the single current transcript per
  step is stored, same one-record-per-step shape the Suitability Scores
  database already has today).
