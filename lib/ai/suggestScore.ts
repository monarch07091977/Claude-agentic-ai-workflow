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
