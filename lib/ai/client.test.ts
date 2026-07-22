import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

vi.mock("./config", () => ({
  aiConfig: { anthropicApiKey: "test-key" },
}));

import { generateStructured } from "./client";

beforeEach(() => {
  createMock.mockReset();
});

describe("generateStructured", () => {
  it("returns the tool_use block's input", async () => {
    createMock.mockResolvedValue({
      content: [
        { type: "text", text: "thinking..." },
        { type: "tool_use", name: "respond", input: { foo: "bar" } },
      ],
    });
    const result = await generateStructured<{ foo: string }>({
      system: "You are a helpful assistant.",
      prompt: "Say something.",
      schema: { type: "object", properties: { foo: { type: "string" } } },
    });
    expect(result).toEqual({ foo: "bar" });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-5",
        system: "You are a helpful assistant.",
        messages: [{ role: "user", content: "Say something." }],
        tool_choice: { type: "tool", name: "respond" },
      })
    );
  });

  it("throws when the response has no tool_use block", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "no tool call" }] });
    await expect(
      generateStructured({ system: "s", prompt: "p", schema: {} })
    ).rejects.toThrow("Model response did not include a tool_use block");
  });
});
