import { getNotionClient } from "./client";
import { notionConfig } from "./config";

export interface MetricRecord {
  id: string;
  processId: string;
  metricName: string;
  category: string;
  baseline: number;
  current: number;
  target: number;
  unit: string;
}

function pageToMetric(page: any): MetricRecord {
  const props = page.properties;
  return {
    id: page.id,
    processId: props.Process?.relation?.[0]?.id ?? "",
    metricName: props["Metric Name"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
    category: props.Category?.select?.name ?? "Cycle Time",
    baseline: props.Baseline?.number ?? 0,
    current: props.Current?.number ?? 0,
    target: props.Target?.number ?? 0,
    unit: props.Unit?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
  };
}

export async function listMetricsForProcess(processId: string): Promise<MetricRecord[]> {
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: notionConfig.valueMetricsDbId,
    filter: { property: "Process", relation: { contains: processId } },
  });
  return response.results.map(pageToMetric);
}

export async function createMetric(input: {
  processId: string;
  metricName: string;
  category: string;
  baseline: number;
  current: number;
  target: number;
  unit: string;
}): Promise<MetricRecord> {
  const notion = getNotionClient();
  const page = await notion.pages.create({
    parent: { database_id: notionConfig.valueMetricsDbId },
    properties: {
      "Metric Name": { title: [{ text: { content: input.metricName } }] },
      Process: { relation: [{ id: input.processId }] },
      Category: { select: { name: input.category } },
      Baseline: { number: input.baseline },
      Current: { number: input.current },
      Target: { number: input.target },
      Unit: { rich_text: [{ text: { content: input.unit } }] },
    },
  });
  return pageToMetric(page);
}
