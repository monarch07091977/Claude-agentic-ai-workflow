import { Client } from "@notionhq/client";

let client: Client | null = null;

export function getNotionClient(): Client {
  if (!client) {
    const token = process.env.NOTION_TOKEN;
    if (!token) {
      throw new Error("NOTION_TOKEN environment variable is not set");
    }
    client = new Client({ auth: token });
  }
  return client;
}
