import type { LanguageModel } from "ai";
import type { ModelId } from "@chat-demo/shared";
import { anthropicModel } from "./anthropic.js";
import { openaiModel } from "./openai.js";
import { ollamaModel } from "./ollama.js";

/**
 * Maps a "provider/model-name" id to a configured AI SDK LanguageModel.
 * Adding a new provider is a single switch case here — callers in the
 * chat service never import provider packages directly.
 *
 * Note: drawthings is handled separately in services/chat.ts (image
 * generation, not text), so it never reaches this resolver.
 */
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
    case "ollama":
      return ollamaModel(modelName);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
