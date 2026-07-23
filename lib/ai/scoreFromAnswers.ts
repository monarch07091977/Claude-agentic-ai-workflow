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
