import { NextResponse } from "next/server";
import { getStep } from "@/lib/notion/steps";
import { generateStructured } from "@/lib/ai/client";
import {
  SUGGEST_SCORE_SYSTEM_PROMPT,
  SUGGEST_SCORE_SCHEMA,
  buildSuggestScorePrompt,
  type SuggestedScore,
} from "@/lib/ai/suggestScore";

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
    const suggestion = await generateStructured<SuggestedScore>({
      system: SUGGEST_SCORE_SYSTEM_PROMPT,
      prompt: buildSuggestScorePrompt(step),
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
