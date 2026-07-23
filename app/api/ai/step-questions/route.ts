import { NextResponse } from "next/server";
import { getStep } from "@/lib/notion/steps";
import { generateStructured } from "@/lib/ai/client";
import {
  STEP_QUESTIONS_SYSTEM_PROMPT,
  STEP_QUESTIONS_SCHEMA,
  buildStepQuestionsPrompt,
  type StepQuestionsResponse,
} from "@/lib/ai/stepQuestions";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.stepId) {
    return NextResponse.json({ error: "stepId is required" }, { status: 400 });
  }
  try {
    const step = await getStep(body.stepId);
    const result = await generateStructured<StepQuestionsResponse>({
      system: STEP_QUESTIONS_SYSTEM_PROMPT,
      prompt: buildStepQuestionsPrompt(step),
      schema: STEP_QUESTIONS_SCHEMA,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to generate questions" }, { status: 500 });
  }
}
