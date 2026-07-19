import { getNotionClient } from "./client";
import { notionConfig } from "./config";
import { computeSuitabilityScore, classifySuitability } from "../scoring";

export interface SuitabilityScoreRecord {
  id: string;
  stepId: string;
  dataComplexity: number;
  decisionLogic: number;
  contextVolatility: number;
  suitabilityScore: number;
  classification: string;
}

function pageToSuitabilityScore(page: any): SuitabilityScoreRecord {
  const props = page.properties;
  return {
    id: page.id,
    stepId: props.Step?.relation?.[0]?.id ?? "",
    dataComplexity: props["Data Complexity"]?.number ?? 0,
    decisionLogic: props["Decision Logic"]?.number ?? 0,
    contextVolatility: props["Context Volatility"]?.number ?? 0,
    suitabilityScore: props["Suitability Score"]?.number ?? 0,
    classification: props.Classification?.select?.name ?? "Algorithmic",
  };
}

export async function listSuitabilityScoresForSteps(
  stepIds: string[]
): Promise<SuitabilityScoreRecord[]> {
  if (stepIds.length === 0) return [];
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: notionConfig.suitabilityDbId,
    filter: {
      or: stepIds.map((id) => ({
        property: "Step",
        relation: { contains: id },
      })),
    },
  });
  return response.results.map(pageToSuitabilityScore);
}

export async function upsertSuitabilityScore(input: {
  stepId: string;
  dataComplexity: number;
  decisionLogic: number;
  contextVolatility: number;
}): Promise<SuitabilityScoreRecord> {
  const notion = getNotionClient();
  const suitabilityScore = computeSuitabilityScore(input);
  const classification = classifySuitability(suitabilityScore);
  const properties = {
    "Data Complexity": { number: input.dataComplexity },
    "Decision Logic": { number: input.decisionLogic },
    "Context Volatility": { number: input.contextVolatility },
    "Suitability Score": { number: suitabilityScore },
    Classification: { select: { name: classification } },
  };

  const existing = await notion.databases.query({
    database_id: notionConfig.suitabilityDbId,
    filter: { property: "Step", relation: { contains: input.stepId } },
  });

  if (existing.results.length > 0) {
    const [canonical, ...duplicates] = existing.results;
    // Self-heals duplicates from a create-race between concurrent requests — Notion has no uniqueness constraint to prevent the race itself.
    if (duplicates.length > 0) {
      await Promise.all(
        duplicates.map((page) =>
          notion.pages.update({ page_id: page.id, archived: true })
        )
      );
    }
    const page = await notion.pages.update({
      page_id: canonical.id,
      properties,
    });
    return pageToSuitabilityScore(page);
  }

  const page = await notion.pages.create({
    parent: { database_id: notionConfig.suitabilityDbId },
    properties: {
      Score: { title: [{ text: { content: "Score" } }] },
      Step: { relation: [{ id: input.stepId }] },
      ...properties,
    },
  });
  return pageToSuitabilityScore(page);
}
