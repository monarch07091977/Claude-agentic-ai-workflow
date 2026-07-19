import { NextResponse } from "next/server";
import { createStep, listStepsForProcess } from "@/lib/notion/steps";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");
  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  try {
    const steps = await listStepsForProcess(processId);
    return NextResponse.json(steps);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load steps" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.processId || !body.stepName) {
    return NextResponse.json(
      { error: "processId and stepName are required" },
      { status: 400 }
    );
  }
  try {
    const step = await createStep({
      processId: body.processId,
      stepName: body.stepName,
      sequence: body.sequence ?? 0,
      handoffType: body.handoffType ?? "System",
      cycleTimeHours: body.cycleTimeHours ?? 0,
      cost: body.cost ?? 0,
      bottleneck: body.bottleneck ?? false,
      notes: body.notes ?? "",
    });
    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create step" }, { status: 500 });
  }
}
