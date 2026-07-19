import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

describe("getNotionClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.NOTION_TOKEN;
  });

  it("throws when NOTION_TOKEN is not set", async () => {
    delete process.env.NOTION_TOKEN;
    const { getNotionClient } = await import("./client");
    expect(() => getNotionClient()).toThrow(
      "NOTION_TOKEN environment variable is not set"
    );
  });

  it("returns a Notion client when NOTION_TOKEN is set", async () => {
    process.env.NOTION_TOKEN = "secret_test";
    const { getNotionClient } = await import("./client");
    expect(getNotionClient()).toBeDefined();
  });
});
