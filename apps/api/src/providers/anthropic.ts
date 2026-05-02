import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";


const anthropicClient = createAnthropic({
  baseURL: "https://api.anthropic.com/v1",
});

export function anthropicModel(modelName: string): LanguageModel {
  return anthropicClient(modelName);
}
