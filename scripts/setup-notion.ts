import { Client } from "@notionhq/client";

async function findExistingDatabaseId(
  notion: Client,
  parentPageId: string,
  title: string
): Promise<string | null> {
  const children = await notion.blocks.children.list({ block_id: parentPageId });
  for (const block of children.results) {
    if ("type" in block && (block as any).type === "child_database") {
      const db = await notion.databases.retrieve({ database_id: block.id });
      const dbTitle = (db as any).title?.map((t: any) => t.plain_text).join("") ?? "";
      if (dbTitle === title) {
        return block.id;
      }
    }
  }
  return null;
}

async function main() {
  const token = process.env.NOTION_TOKEN;
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;
  if (!token) throw new Error("NOTION_TOKEN environment variable is not set");
  if (!parentPageId) {
    throw new Error("NOTION_PARENT_PAGE_ID environment variable is not set");
  }

  const notion = new Client({ auth: token });

  const existingProcessesId = await findExistingDatabaseId(notion, parentPageId, "Processes");
  const existingStepsId = await findExistingDatabaseId(notion, parentPageId, "Process Steps");

  if ((existingProcessesId && !existingStepsId) || (!existingProcessesId && existingStepsId)) {
    throw new Error(
      "Found only one of the 'Processes'/'Process Steps' databases under the parent page. Both must exist together, or neither — resolve manually before re-running."
    );
  }

  let processesDbId: string;
  let stepsDbId: string;

  if (existingProcessesId && existingStepsId) {
    console.log("Processes and Process Steps databases already exist, reusing them.");
    processesDbId = existingProcessesId;
    stepsDbId = existingStepsId;
  } else {
    const processesDb = await notion.databases.create({
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: "Processes" } }],
      properties: {
        Name: { title: {} },
        Description: { rich_text: {} },
        Owner: { rich_text: {} },
        Status: {
          select: {
            options: [
              { name: "Not Started", color: "gray" },
              { name: "In Progress", color: "yellow" },
              { name: "Complete", color: "green" },
            ],
          },
        },
        "Current Phase": {
          select: {
            options: [
              { name: "1", color: "blue" },
              { name: "2", color: "blue" },
              { name: "3", color: "blue" },
              { name: "4", color: "blue" },
            ],
          },
        },
      },
    });

    const stepsDb = await notion.databases.create({
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: "Process Steps" } }],
      properties: {
        "Step Name": { title: {} },
        Process: {
          relation: {
            database_id: processesDb.id,
            type: "dual_property",
            dual_property: {},
          },
        },
        Sequence: { number: { format: "number" } },
        "Handoff Type": {
          select: {
            options: [
              { name: "System", color: "blue" },
              { name: "Human", color: "orange" },
              { name: "Cross-team", color: "purple" },
              { name: "External", color: "red" },
            ],
          },
        },
        "Cycle Time (hrs)": { number: { format: "number" } },
        Cost: { number: { format: "number" } },
        Bottleneck: { checkbox: {} },
        Notes: { rich_text: {} },
      },
    });

    const processesDbFull = await notion.databases.retrieve({
      database_id: processesDb.id,
    });
    const backRelation = Object.values(processesDbFull.properties).find(
      (prop: any) => prop.type === "relation"
    ) as any;
    if (!backRelation) {
      throw new Error("Could not find the auto-created relation property on Processes");
    }

    await notion.databases.update({
      database_id: processesDb.id,
      properties: {
        [backRelation.name]: { name: "Steps" },
        "Total Cycle Time (hrs)": {
          rollup: {
            relation_property_name: "Steps",
            rollup_property_name: "Cycle Time (hrs)",
            function: "sum",
          },
        },
        "Total Cost": {
          rollup: {
            relation_property_name: "Steps",
            rollup_property_name: "Cost",
            function: "sum",
          },
        },
        "Bottleneck Count": {
          rollup: {
            relation_property_name: "Steps",
            rollup_property_name: "Bottleneck",
            function: "checked",
          },
        },
      },
    });

    processesDbId = processesDb.id;
    stepsDbId = stepsDb.id;
  }

  let suitabilityDbId = await findExistingDatabaseId(notion, parentPageId, "Suitability Scores");
  if (suitabilityDbId) {
    console.log("Suitability Scores database already exists, reusing it.");
  } else {
    const suitabilityDb = await notion.databases.create({
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: "Suitability Scores" } }],
      properties: {
        Score: { title: {} },
        Step: {
          relation: {
            database_id: stepsDbId,
            type: "single_property",
            single_property: {},
          },
        },
        "Data Complexity": { number: { format: "number" } },
        "Decision Logic": { number: { format: "number" } },
        "Context Volatility": { number: { format: "number" } },
        "Suitability Score": { number: { format: "number" } },
        Classification: {
          select: {
            options: [
              { name: "Algorithmic", color: "blue" },
              { name: "Agentic", color: "green" },
              { name: "Human-required", color: "orange" },
            ],
          },
        },
      },
    });
    suitabilityDbId = suitabilityDb.id;
  }

  let agentBlueprintDbId = await findExistingDatabaseId(notion, parentPageId, "Agent Blueprint");
  if (agentBlueprintDbId) {
    console.log("Agent Blueprint database already exists, reusing it.");
  } else {
    const agentBlueprintDb = await notion.databases.create({
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: "Agent Blueprint" } }],
      properties: {
        "Agent Name": { title: {} },
        Process: {
          relation: {
            database_id: processesDbId,
            type: "single_property",
            single_property: {},
          },
        },
        Role: { rich_text: {} },
        "Trigger Event": { rich_text: {} },
        "HITL Exception Rule": { rich_text: {} },
      },
    });

    await notion.databases.update({
      database_id: agentBlueprintDb.id,
      properties: {
        "Upstream Agent": {
          relation: {
            database_id: agentBlueprintDb.id,
            type: "dual_property",
            dual_property: {},
          },
        },
      },
    });

    const agentBlueprintDbFull = await notion.databases.retrieve({
      database_id: agentBlueprintDb.id,
    });
    const downstreamRelation = Object.values(agentBlueprintDbFull.properties).find(
      (prop: any) =>
        prop.type === "relation" && prop.name !== "Upstream Agent" && prop.name !== "Process"
    ) as any;
    if (!downstreamRelation) {
      throw new Error(
        "Could not find the auto-created back-relation property on Agent Blueprint"
      );
    }
    await notion.databases.update({
      database_id: agentBlueprintDb.id,
      properties: {
        [downstreamRelation.name]: { name: "Downstream Agents" },
      },
    });

    agentBlueprintDbId = agentBlueprintDb.id;
  }

  console.log("Notion setup complete. Add these to your .env.local:\n");
  console.log(`NOTION_PROCESSES_DB_ID=${processesDbId}`);
  console.log(`NOTION_STEPS_DB_ID=${stepsDbId}`);
  console.log(`NOTION_SUITABILITY_DB_ID=${suitabilityDbId}`);
  console.log(`NOTION_AGENT_BLUEPRINT_DB_ID=${agentBlueprintDbId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
