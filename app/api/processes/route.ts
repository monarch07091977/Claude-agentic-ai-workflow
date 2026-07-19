import { NextResponse } from "next/server";
import { createProcess, listProcesses } from "@/lib/notion/processes";

export async function GET() {
  const processes = await listProcesses();
  return NextResponse.json(processes);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const process = await createProcess({
    name: body.name,
    description: body.description ?? "",
    owner: body.owner ?? "",
  });
  return NextResponse.json(process, { status: 201 });
}
