import type { Tool } from "ai";
import { calculate } from "./calculate.js";
import { getCurrentTime } from "./get-current-time.js";

/**
 * Every tool the backend can offer. Keys are the tool names the model
 * sees and that the frontend's toolkit registers renderers under — the
 * three sides (model, server registry, frontend renderer) must agree.
 *
 * Adding a new tool: write a new file under tools/, add an entry here,
 * register a renderer in apps/web/src/tools/toolkit.ts, allow it for
 * one or more prompts in prompts/registry.ts. Four files, no other
 * code touched.
 */
export const TOOLS = {
  calculate,
  getCurrentTime,
} as const satisfies Record<string, Tool>;

export type ToolName = keyof typeof TOOLS;

/**
 * Pick the subset of tools whose names appear in `allowed`. This is the
 * gate that lets a prompt entry restrict what the model can do — even
 * if the model decides to call a tool it isn't supposed to know about,
 * we just don't pass it in, so the model can't actually call it.
 */
export function selectTools(allowed: readonly string[]): Record<string, Tool> {
  const result: Record<string, Tool> = {};
  for (const name of allowed) {
    if (name in TOOLS) {
      result[name] = TOOLS[name as ToolName];
    }
  }
  return result;
}
