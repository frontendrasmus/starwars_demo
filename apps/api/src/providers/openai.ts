import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";


export function openaiModel(modelName: string): LanguageModel {
  return openai(modelName);
}
