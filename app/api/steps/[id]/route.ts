import { NextResponse } from "next/server";
import { deleteStep, updateStep } from "@/lib/notion/steps";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const step = await updateStep(params.id, body);
    return NextResponse.json(step);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update step" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteStep(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete step" }, { status: 500 });
  }
}
