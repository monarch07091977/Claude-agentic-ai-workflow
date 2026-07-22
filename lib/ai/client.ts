import Anthropic from "@anthropic-ai/sdk";
import { aiConfig } from "./config";

const MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: aiConfig.anthropicApiKey });
  }
  return client;
}

export async function generateStructured<T>(params: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
    tools: [
      {
        name: "respond",
        description: "Provide the structured response for this request.",
        input_schema: params.schema as any,
      },
    ],
    tool_choice: { type: "tool", name: "respond" },
  });

  const toolUse = response.content.find(
    (block: any) => block.type === "tool_use"
  ) as any;
  if (!toolUse) {
    throw new Error("Model response did not include a tool_use block");
  }
  return toolUse.input as T;
}
