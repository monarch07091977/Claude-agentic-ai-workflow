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
