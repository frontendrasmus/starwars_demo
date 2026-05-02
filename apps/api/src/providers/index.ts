import type { LanguageModel } from "ai";
import type { ModelId } from "@chat-demo/shared";
import { anthropicModel } from "./anthropic.js";
import { openaiModel } from "./openai.js";


export function resolveModel(id: ModelId): LanguageModel {
  const slashIndex = id.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(`Malformed ModelId (expected "provider/name"): ${id}`);
  }
  const provider = id.slice(0, slashIndex);
  const modelName = id.slice(slashIndex + 1);

  switch (provider) {
    case "anthropic":
      return anthropicModel(modelName);
    case "openai":
      return openaiModel(modelName);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
