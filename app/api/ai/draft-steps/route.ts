import { NextResponse } from "next/server";
import { generateStructured } from "@/lib/ai/client";
import { parseStepRows } from "@/lib/importSteps";
import {
  DRAFT_STEPS_SYSTEM_PROMPT,
  DRAFT_STEPS_SCHEMA,
  STEP_ROW_HEADER,
  buildDraftStepsPrompt,
  type DraftStepsResponse,
} from "@/lib/ai/draftSteps";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.rawText || typeof body.rawText !== "string") {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }
  try {
    const draft = await generateStructured<DraftStepsResponse>({
      system: DRAFT_STEPS_SYSTEM_PROMPT,
      prompt: buildDraftStepsPrompt(body.rawText),
      schema: DRAFT_STEPS_SCHEMA,
    });
    const { valid, skipped } = parseStepRows([STEP_ROW_HEADER, ...draft.rows]);
    return NextResponse.json({ steps: valid, skipped });
  } catch {
    return NextResponse.json({ error: "Failed to draft steps" }, { status: 500 });
  }
}
