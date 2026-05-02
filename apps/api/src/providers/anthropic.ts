import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Build an Anthropic LanguageModel for the given model name
 * (e.g. "claude-opus-4-7").
 *
 * We pin baseURL to the canonical v1 endpoint so that a system-level
 * ANTHROPIC_BASE_URL env var (e.g. missing the /v1 suffix) can't
 * silently route requests to the wrong path. ANTHROPIC_API_KEY is still
 * read from the environment automatically.
 */
const anthropicClient = createAnthropic({
  baseURL: "https://api.anthropic.com/v1",
});

export function anthropicModel(modelName: string): LanguageModel {
  return anthropicClient(modelName);
}
