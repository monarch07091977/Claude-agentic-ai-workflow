import { NextResponse } from "next/server";
import { listStepsForProcess } from "@/lib/notion/steps";
import {
  listSuitabilityScoresForSteps,
  upsertSuitabilityScore,
} from "@/lib/notion/suitability";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");
  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  try {
    const steps = await listStepsForProcess(processId);
    const scores = await listSuitabilityScoresForSteps(steps.map((step) => step.id));
    return NextResponse.json(scores);
  } catch {
    return NextResponse.json(
      { error: "Failed to load suitability scores" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    !body.stepId ||
    typeof body.dataComplexity !== "number" ||
    typeof body.decisionLogic !== "number" ||
    typeof body.contextVolatility !== "number"
  ) {
    return NextResponse.json(
      {
        error:
          "stepId, dataComplexity, decisionLogic, and contextVolatility are required",
      },
      { status: 400 }
    );
  }
  try {
    const score = await upsertSuitabilityScore({
      stepId: body.stepId,
      dataComplexity: body.dataComplexity,
      decisionLogic: body.decisionLogic,
      contextVolatility: body.contextVolatility,
    });
    return NextResponse.json(score, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to save suitability score" },
      { status: 500 }
    );
  }
}
