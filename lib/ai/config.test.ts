import { describe, it, expect, afterEach } from "vitest";
import { aiConfig } from "./config";

describe("aiConfig", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("throws when ANTHROPIC_API_KEY is not set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => aiConfig.anthropicApiKey).toThrow(
      "ANTHROPIC_API_KEY environment variable is not set"
    );
  });

  it("returns the value when set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(aiConfig.anthropicApiKey).toBe("sk-ant-test");
  });
});
