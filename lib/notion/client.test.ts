import { describe, it, expect, afterEach } from "vitest";
import { getNotionClient } from "./client";

describe("getNotionClient", () => {
  afterEach(() => {
    delete process.env.NOTION_TOKEN;
  });

  it("throws when NOTION_TOKEN is not set", () => {
    delete process.env.NOTION_TOKEN;
    expect(() => getNotionClient()).toThrow(
      "NOTION_TOKEN environment variable is not set"
    );
  });

  it("returns a Notion client when NOTION_TOKEN is set", () => {
    process.env.NOTION_TOKEN = "secret_test";
    expect(getNotionClient()).toBeDefined();
  });
});
