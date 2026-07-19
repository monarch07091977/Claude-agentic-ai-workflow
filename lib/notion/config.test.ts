import { describe, it, expect, afterEach } from "vitest";
import { notionConfig } from "./config";

describe("notionConfig", () => {
  afterEach(() => {
    delete process.env.NOTION_PARENT_PAGE_ID;
    delete process.env.NOTION_PROCESSES_DB_ID;
    delete process.env.NOTION_STEPS_DB_ID;
  });

  it("throws when NOTION_PARENT_PAGE_ID is not set", () => {
    delete process.env.NOTION_PARENT_PAGE_ID;
    expect(() => notionConfig.parentPageId).toThrow(
      "NOTION_PARENT_PAGE_ID environment variable is not set"
    );
  });

  it("returns the value when set", () => {
    process.env.NOTION_PARENT_PAGE_ID = "abc123";
    expect(notionConfig.parentPageId).toBe("abc123");
  });

  it("exposes processesDbId and stepsDbId the same way", () => {
    process.env.NOTION_PROCESSES_DB_ID = "processes-db";
    process.env.NOTION_STEPS_DB_ID = "steps-db";
    expect(notionConfig.processesDbId).toBe("processes-db");
    expect(notionConfig.stepsDbId).toBe("steps-db");
  });
});
