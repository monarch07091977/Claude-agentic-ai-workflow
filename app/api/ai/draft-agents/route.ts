import { NextResponse } from "next/server";
import { listStepsForProcess } from "@/lib/notion/steps";
import { listSuitabilityScoresForSteps } from "@/lib/notion/suitability";
import { generateStructured } from "@/lib/ai/client";
import {
  DRAFT_AGENTS_SYSTEM_PROMPT,
  DRAFT_AGENTS_SCHEMA,
  selectAgenticSteps,
  buildDraftAgentsPrompt,
  type DraftAgentsResponse,
} from "@/lib/ai/draftAgents";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  try {
    const steps = await listStepsForProcess(body.processId);
    const scores = await listSuitabilityScoresForSteps(steps.map((step) => step.id));
    const agenticSteps = selectAgenticSteps(steps, scores);
    if (agenticSteps.length === 0) {
      return NextResponse.json({ agents: [] });
    }
    const draft = await generateStructured<DraftAgentsResponse>({
      system: DRAFT_AGENTS_SYSTEM_PROMPT,
      prompt: buildDraftAgentsPrompt(agenticSteps),
      schema: DRAFT_AGENTS_SCHEMA,
      maxTokens: 4096,
    });
    return NextResponse.json(draft);
  } catch {
    return NextResponse.json(
      { error: "Failed to draft agent blueprint" },
      { status: 500 }
    );
  }
}
