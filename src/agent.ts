import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import { toolDefinitions, toolHandlers } from "./tools";

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const SYSTEM_PROMPT =
  "You are a helpful assistant chatting with a user over WhatsApp. " +
  "Keep replies short and conversational, suitable for a chat bubble. " +
  "Use plain text only (WhatsApp does not render Markdown headings or tables).";

const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ROUNDS = 5;

const conversations = new Map<string, Anthropic.MessageParam[]>();

function getHistory(userId: string): Anthropic.MessageParam[] {
  return conversations.get(userId) ?? [];
}

function saveHistory(userId: string, messages: Anthropic.MessageParam[]): void {
  conversations.set(userId, messages.slice(-MAX_HISTORY_MESSAGES));
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/**
 * Runs one turn of the agent loop for a given WhatsApp user: sends their message
 * to Claude, executes any requested tool calls, and returns the final reply text.
 */
export async function generateReply(userId: string, userText: string): Promise<string> {
  const messages = [...getHistory(userId), { role: "user" as const, content: userText }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: config.claudeModel,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      saveHistory(userId, messages);
      return extractText(response.content) || "Sorry, I didn't catch that.";
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const handler = toolHandlers[block.name];
      const result = handler
        ? await handler(block.input)
        : `Unknown tool: ${block.name}`;
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }

    messages.push({ role: "user", content: toolResults });
  }

  saveHistory(userId, messages);
  return "Sorry, that took too many steps for me to resolve. Could you rephrase?";
}
