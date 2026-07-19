import { NextResponse } from "next/server";
import { createAgent, listAgentsForProcess } from "@/lib/notion/agents";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get("processId");
  if (!processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  try {
    const agents = await listAgentsForProcess(processId);
    return NextResponse.json(agents);
  } catch {
    return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.processId || !body.agentName) {
    return NextResponse.json(
      { error: "processId and agentName are required" },
      { status: 400 }
    );
  }
  try {
    const agent = await createAgent({
      processId: body.processId,
      agentName: body.agentName,
      role: body.role ?? "",
      triggerEvent: body.triggerEvent ?? "",
      upstreamAgentId: body.upstreamAgentId ?? "",
      hitlExceptionRule: body.hitlExceptionRule ?? "",
    });
    return NextResponse.json(agent, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add agent" }, { status: 500 });
  }
}
