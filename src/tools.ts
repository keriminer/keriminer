import type Anthropic from "@anthropic-ai/sdk";

export type ToolHandler = (input: any) => Promise<string> | string;

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "get_current_time",
    description: "Get the current date and time in UTC. Use this whenever the user asks what time or day it is.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

export const toolHandlers: Record<string, ToolHandler> = {
  get_current_time: () => new Date().toISOString(),
};
