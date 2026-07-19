import { NextResponse } from "next/server";
import { createProcess, listProcesses } from "@/lib/notion/processes";

export async function GET() {
  try {
    const processes = await listProcesses();
    return NextResponse.json(processes);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load processes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  try {
    const process = await createProcess({
      name: body.name,
      description: body.description ?? "",
      owner: body.owner ?? "",
    });
    return NextResponse.json(process, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create process" }, { status: 500 });
  }
}
