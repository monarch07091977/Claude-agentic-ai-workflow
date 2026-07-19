import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createStep, listStepsForProcess } from "@/lib/notion/steps";
import { parseStepRows } from "@/lib/importSteps";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const processId = formData.get("processId");
  const file = formData.get("file");

  if (typeof processId !== "string" || !processId) {
    return NextResponse.json({ error: "processId is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  let rows: unknown[][];
  try {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: "Spreadsheet has no worksheet" }, { status: 400 });
    }
    rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[];
      rows.push(values.slice(1));
    });
  } catch {
    return NextResponse.json({ error: "Failed to read spreadsheet file" }, { status: 400 });
  }

  const { valid, skipped } = parseStepRows(rows);

  try {
    const existingSteps = await listStepsForProcess(processId);
    let sequence = existingSteps.length;
    let importedCount = 0;
    for (const row of valid) {
      sequence += 1;
      await createStep({
        processId,
        stepName: row.stepName,
        sequence,
        handoffType: row.handoffType,
        cycleTimeHours: row.cycleTimeHours,
        cost: row.cost,
        bottleneck: row.bottleneck,
        notes: row.notes,
      });
      importedCount += 1;
    }
    return NextResponse.json({ imported: importedCount, skipped }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to import steps" }, { status: 500 });
  }
}
