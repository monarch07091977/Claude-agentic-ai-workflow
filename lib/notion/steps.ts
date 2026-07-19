import { getNotionClient } from "./client";
import { notionConfig } from "./config";

export interface StepRecord {
  id: string;
  processId: string;
  stepName: string;
  sequence: number;
  handoffType: string;
  cycleTimeHours: number;
  cost: number;
  bottleneck: boolean;
  notes: string;
}

function pageToStep(page: any): StepRecord {
  const props = page.properties;
  return {
    id: page.id,
    processId: props.Process.relation[0]?.id ?? "",
    stepName: props["Step Name"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
    sequence: props.Sequence.number ?? 0,
    handoffType: props["Handoff Type"].select?.name ?? "System",
    cycleTimeHours: props["Cycle Time (hrs)"].number ?? 0,
    cost: props.Cost.number ?? 0,
    bottleneck: props.Bottleneck?.checkbox ?? false,
    notes: props.Notes?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
  };
}

export async function listStepsForProcess(processId: string): Promise<StepRecord[]> {
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: notionConfig.stepsDbId,
    filter: { property: "Process", relation: { contains: processId } },
    sorts: [{ property: "Sequence", direction: "ascending" }],
  });
  return response.results.map(pageToStep);
}

export async function createStep(input: {
  processId: string;
  stepName: string;
  sequence: number;
  handoffType: string;
  cycleTimeHours: number;
  cost: number;
  bottleneck: boolean;
  notes: string;
}): Promise<StepRecord> {
  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: { database_id: notionConfig.stepsDbId },
    properties: {
      "Step Name": { title: [{ text: { content: input.stepName } }] },
      Process: { relation: [{ id: input.processId }] },
      Sequence: { number: input.sequence },
      "Handoff Type": { select: { name: input.handoffType } },
      "Cycle Time (hrs)": { number: input.cycleTimeHours },
      Cost: { number: input.cost },
      Bottleneck: { checkbox: input.bottleneck },
      Notes: { rich_text: [{ text: { content: input.notes } }] },
    },
  });
  return pageToStep(page);
}

export async function updateStep(
  id: string,
  input: Partial<{
    stepName: string;
    sequence: number;
    handoffType: string;
    cycleTimeHours: number;
    cost: number;
    bottleneck: boolean;
    notes: string;
  }>
): Promise<StepRecord> {
  const notion = getNotionClient();
  const properties: Record<string, any> = {};
  if (input.stepName !== undefined) {
    properties["Step Name"] = { title: [{ text: { content: input.stepName } }] };
  }
  if (input.sequence !== undefined) {
    properties.Sequence = { number: input.sequence };
  }
  if (input.handoffType !== undefined) {
    properties["Handoff Type"] = { select: { name: input.handoffType } };
  }
  if (input.cycleTimeHours !== undefined) {
    properties["Cycle Time (hrs)"] = { number: input.cycleTimeHours };
  }
  if (input.cost !== undefined) {
    properties.Cost = { number: input.cost };
  }
  if (input.bottleneck !== undefined) {
    properties.Bottleneck = { checkbox: input.bottleneck };
  }
  if (input.notes !== undefined) {
    properties.Notes = { rich_text: [{ text: { content: input.notes } }] };
  }
  const page = await notion.pages.update({ page_id: id, properties });
  return pageToStep(page);
}

export async function deleteStep(id: string): Promise<void> {
  const notion = getNotionClient();
  await notion.pages.update({ page_id: id, archived: true });
}
