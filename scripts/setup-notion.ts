import { Client } from "@notionhq/client";

async function main() {
  const token = process.env.NOTION_TOKEN;
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;
  if (!token) throw new Error("NOTION_TOKEN environment variable is not set");
  if (!parentPageId) {
    throw new Error("NOTION_PARENT_PAGE_ID environment variable is not set");
  }

  const notion = new Client({ auth: token });

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

  console.log("Notion setup complete. Add these to your .env.local:\n");
  console.log(`NOTION_PROCESSES_DB_ID=${processesDb.id}`);
  console.log(`NOTION_STEPS_DB_ID=${stepsDb.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
