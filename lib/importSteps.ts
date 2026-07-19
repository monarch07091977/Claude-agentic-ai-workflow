export interface ParsedStepRow {
  stepName: string;
  handoffType: string;
  cycleTimeHours: number;
  cost: number;
  bottleneck: boolean;
  notes: string;
}

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface ParseStepRowsResult {
  valid: ParsedStepRow[];
  skipped: SkippedRow[];
}

const VALID_HANDOFF_TYPES = ["System", "Human", "Cross-team", "External"];

function findColumn(header: string[], names: string[]): number {
  return header.findIndex((h) => names.includes(h));
}

export function parseStepRows(rows: unknown[][]): ParseStepRowsResult {
  if (rows.length === 0) {
    return { valid: [], skipped: [] };
  }

  const header = rows[0].map((cell) => String(cell ?? "").trim().toLowerCase());

  const stepNameCol = findColumn(header, ["step name", "name"]);
  const handoffTypeCol = findColumn(header, ["handoff type", "handoff"]);
  const cycleTimeCol = findColumn(header, [
    "cycle time (hrs)",
    "cycle time",
    "cycle time hrs",
  ]);
  const costCol = findColumn(header, ["cost"]);
  const bottleneckCol = findColumn(header, ["bottleneck"]);
  const notesCol = findColumn(header, ["notes"]);

  if (stepNameCol === -1) {
    return {
      valid: [],
      skipped: [{ row: 0, reason: "Missing required 'Step Name' column in header row" }],
    };
  }

  const valid: ParsedStepRow[] = [];
  const skipped: SkippedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i;
    const stepName = String(row[stepNameCol] ?? "").trim();
    if (!stepName) {
      skipped.push({ row: rowNumber, reason: "Missing Step Name" });
      continue;
    }

    const rawHandoffType =
      handoffTypeCol >= 0 ? String(row[handoffTypeCol] ?? "").trim() : "";
    const handoffType = VALID_HANDOFF_TYPES.includes(rawHandoffType)
      ? rawHandoffType
      : "System";

    const cycleTimeHours = cycleTimeCol >= 0 ? Number(row[cycleTimeCol]) || 0 : 0;
    const cost = costCol >= 0 ? Number(row[costCol]) || 0 : 0;

    const rawBottleneck =
      bottleneckCol >= 0 ? String(row[bottleneckCol] ?? "").trim().toLowerCase() : "";
    const bottleneck = ["yes", "true", "1"].includes(rawBottleneck);

    const notes = notesCol >= 0 ? String(row[notesCol] ?? "").trim() : "";

    valid.push({ stepName, handoffType, cycleTimeHours, cost, bottleneck, notes });
  }

  return { valid, skipped };
}
