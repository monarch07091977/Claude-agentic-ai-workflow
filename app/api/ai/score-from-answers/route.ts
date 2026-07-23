import { NextResponse } from "next/server";
import { getStep } from "@/lib/notion/steps";
import { generateStructured } from "@/lib/ai/client";
import { SUGGEST_SCORE_SCHEMA, type SuggestedScore } from "@/lib/ai/suggestScore";
import {
  SCORE_FROM_ANSWERS_SYSTEM_PROMPT,
  buildScoreFromAnswersPrompt,
  type AnsweredQuestion,
} from "@/lib/ai/scoreFromAnswers";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.stepId || !Array.isArray(body.answers)) {
    return NextResponse.json(
      { error: "stepId and answers are required" },
      { status: 400 }
    );
  }
  try {
    const step = await getStep(body.stepId);
    const suggestion = await generateStructured<SuggestedScore>({
      system: SCORE_FROM_ANSWERS_SYSTEM_PROMPT,
      prompt: buildScoreFromAnswersPrompt(step, body.answers as AnsweredQuestion[]),
      schema: SUGGEST_SCORE_SCHEMA,
    });
    return NextResponse.json(suggestion);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate a score suggestion" },
      { status: 500 }
    );
  }
}
