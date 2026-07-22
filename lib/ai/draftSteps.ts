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
