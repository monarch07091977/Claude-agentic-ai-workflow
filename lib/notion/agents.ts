import { getNotionClient } from "./client";
import { notionConfig } from "./config";

export interface AgentRecord {
  id: string;
  processId: string;
  agentName: string;
  role: string;
  triggerEvent: string;
  upstreamAgentId: string;
  hitlExceptionRule: string;
}

function pageToAgent(page: any): AgentRecord {
  const props = page.properties;
  return {
    id: page.id,
    processId: props.Process?.relation?.[0]?.id ?? "",
    agentName: props["Agent Name"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
    role: props.Role?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
    triggerEvent:
      props["Trigger Event"]?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
    upstreamAgentId: props["Upstream Agent"]?.relation?.[0]?.id ?? "",
    hitlExceptionRule:
      props["HITL Exception Rule"]?.rich_text?.map((t: any) => t.plain_text).join("") ?? "",
  };
}

export async function listAgentsForProcess(processId: string): Promise<AgentRecord[]> {
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: notionConfig.agentBlueprintDbId,
    filter: { property: "Process", relation: { contains: processId } },
  });
  return response.results.map(pageToAgent);
}

export async function createAgent(input: {
  processId: string;
  agentName: string;
  role: string;
  triggerEvent: string;
  upstreamAgentId: string;
  hitlExceptionRule: string;
}): Promise<AgentRecord> {
  const notion = getNotionClient();
  const properties: Record<string, any> = {
    "Agent Name": { title: [{ text: { content: input.agentName } }] },
    Process: { relation: [{ id: input.processId }] },
    Role: { rich_text: [{ text: { content: input.role } }] },
    "Trigger Event": { rich_text: [{ text: { content: input.triggerEvent } }] },
    "HITL Exception Rule": { rich_text: [{ text: { content: input.hitlExceptionRule } }] },
  };
  if (input.upstreamAgentId) {
    properties["Upstream Agent"] = { relation: [{ id: input.upstreamAgentId }] };
  }
  const page = await notion.pages.create({
    parent: { database_id: notionConfig.agentBlueprintDbId },
    properties,
  });
  return pageToAgent(page);
}
