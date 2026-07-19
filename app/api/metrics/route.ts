import { NextResponse } from "next/server";
import { createMetric, listMetricsForProcess } from "@/lib/notion/metrics";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");
  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  try {
    const metrics = await listMetricsForProcess(processId);
    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
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
    !body.processId ||
    !body.metricName ||
    !body.category ||
    typeof body.baseline !== "number" ||
    typeof body.current !== "number" ||
    typeof body.target !== "number"
  ) {
    return NextResponse.json(
      {
        error:
          "processId, metricName, category, baseline, current, and target are required",
      },
      { status: 400 }
    );
  }
  try {
    const metric = await createMetric({
      processId: body.processId,
      metricName: body.metricName,
      category: body.category,
      baseline: body.baseline,
      current: body.current,
      target: body.target,
      unit: body.unit ?? "",
    });
    return NextResponse.json(metric, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add metric" }, { status: 500 });
  }
}
