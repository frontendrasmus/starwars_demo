import type { Tool } from "ai";
import { calculate } from "./calculate.js";
import { getCurrentTime } from "./get-current-time.js";
import { searchKnowledge } from "./search-knowledge.js";


export const TOOLS = {
  calculate,
  getCurrentTime,
  searchKnowledge,
} as const satisfies Record<string, Tool>;

export type ToolName = keyof typeof TOOLS;


export function selectTools(allowed: readonly string[]): Record<string, Tool> {
  const result: Record<string, Tool> = {};
  for (const name of allowed) {
    if (name in TOOLS) {
      result[name] = TOOLS[name as ToolName];
    }
  }
  return result;
}
