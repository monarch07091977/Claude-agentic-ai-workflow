import type { StepRecord } from "../notion/steps";
import type { SuitabilityScoreRecord } from "../notion/suitability";

export const DRAFT_AGENTS_SYSTEM_PROMPT =
  "You are helping a business process consultant design an agent blueprint: which AI agents should own a set of workflow steps, in what order they hand off to each other, and where a human needs to stay in the loop. Respond only by calling the respond tool.";

export interface AgenticStep {
  stepName: string;
  handoffType: string;
}

export function selectAgenticSteps(
  steps: StepRecord[],
  scores: SuitabilityScoreRecord[]
): AgenticStep[] {
  const agenticStepIds = new Set(
    scores.filter((score) => score.classification === "Agentic").map((score) => score.stepId)
  );
  return steps
    .filter((step) => agenticStepIds.has(step.id))
    .map((step) => ({ stepName: step.stepName, handoffType: step.handoffType }));
}

export function buildDraftAgentsPrompt(agenticSteps: AgenticStep[]): string {
  const stepList = agenticSteps
    .map((step, i) => `${i + 1}. "${step.stepName}" (handoff: ${step.handoffType})`)
    .join("\n");
  return `These workflow steps have been classified as good candidates for an AI agent:\n${stepList}\n\nPropose an agent blueprint: group these steps into one or more agents (an agent can own more than one step if they naturally belong together), name each agent, describe its role in one sentence, state the event that triggers it, and order them by upstream handoff (the first agent in your list has no upstream; each later agent's upstreamAgentName names the agent that hands off to it — use exactly the agentName you gave that earlier agent, or null if it has no upstream). For any agent whose action is risky enough that a human should be able to intervene (e.g. anything touching money, external communication, or an irreversible action), set hitlExceptionRule to the condition that should trigger human review; otherwise set it to null.`;
}

export const DRAFT_AGENTS_SCHEMA = {
  type: "object",
  properties: {
    agents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          agentName: { type: "string" },
          role: { type: "string" },
          triggerEvent: { type: "string" },
          upstreamAgentName: { type: ["string", "null"] },
          hitlExceptionRule: { type: ["string", "null"] },
          rationale: { type: "string" },
        },
        required: [
          "agentName",
          "role",
          "triggerEvent",
          "upstreamAgentName",
          "hitlExceptionRule",
          "rationale",
        ],
      },
    },
  },
  required: ["agents"],
};

export interface DraftedAgent {
  agentName: string;
  role: string;
  triggerEvent: string;
  upstreamAgentName: string | null;
  hitlExceptionRule: string | null;
  rationale: string;
}

export interface DraftAgentsResponse {
  agents: DraftedAgent[];
}
