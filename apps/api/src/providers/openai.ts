import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Build an OpenAI LanguageModel for the given model name
 * (e.g. "gpt-5", "gpt-4o").
 *
 * Reads OPENAI_API_KEY from the environment by default.
 */
export function openaiModel(modelName: string): LanguageModel {
  return openai(modelName);
}
