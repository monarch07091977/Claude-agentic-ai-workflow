import { getNotionClient } from "./client";
import { notionConfig } from "./config";

export interface ProcessRecord {
  id: string;
  name: string;
  description: string;
  owner: string;
  status: string;
  currentPhase: string;
  totalCycleTimeHours: number;
}

function pageToProcess(page: any): ProcessRecord {
  const props = page.properties;
  return {
    id: page.id,
    name: props.Name?.title?.map((t: any) => t.plain_text).join("") ?? "",
    description: props.Description?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
    owner: props.Owner?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
    status: props.Status?.select?.name ?? "Not Started",
    currentPhase: props["Current Phase"]?.select?.name ?? "1",
    totalCycleTimeHours: props["Total Cycle Time (hrs)"]?.rollup?.number ?? 0,
  };
}

export async function listProcesses(): Promise<ProcessRecord[]> {
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: notionConfig.processesDbId,
  });
  return response.results.map(pageToProcess);
}

export async function createProcess(input: {
  name: string;
  description: string;
  owner: string;
}): Promise<ProcessRecord> {
  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: { database_id: notionConfig.processesDbId },
    properties: {
      Name: { title: [{ text: { content: input.name } }] },
      Description: { rich_text: [{ text: { content: input.description } }] },
      Owner: { rich_text: [{ text: { content: input.owner } }] },
      Status: { select: { name: "Not Started" } },
      "Current Phase": { select: { name: "1" } },
    },
  });
  return pageToProcess(page);
}
