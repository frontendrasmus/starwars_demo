import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Build an Anthropic LanguageModel for the given model name
 * (e.g. "claude-opus-4-7").
 *
 * The @ai-sdk/anthropic package reads ANTHROPIC_API_KEY from the
 * environment by default. If you need a scoped client (different keys
 * per tenant, a proxy, etc.), replace `anthropic(...)` with
 * `createAnthropic({ apiKey, baseURL }).chat(modelName)`.
 */
export function anthropicModel(modelName: string): LanguageModel {
  return anthropic(modelName);
}
