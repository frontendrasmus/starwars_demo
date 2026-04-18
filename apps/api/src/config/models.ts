import type { ModelDescriptor, ModelId } from "@chat-demo/shared";

/**
 * The models this backend knows about.
 *
 * The IDs follow a "{provider}/{model-name}" convention that the providers
 * layer parses. Keep IDs stable — the frontend sends them back on every
 * request, and changing one will break in-flight chats.
 *
 * Update these as providers ship new models.
 */
export const MODELS: ModelDescriptor[] = [
  { id: "anthropic/claude-opus-4-7", label: "Claude Opus 4.7", provider: "anthropic" },
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "openai/gpt-5", label: "GPT-5", provider: "openai" },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "openai" },
];

export const DEFAULT_MODEL_ID: ModelId = "anthropic/claude-opus-4-7";

export function isKnownModel(id: string): id is ModelId {
  return MODELS.some((m) => m.id === id);
}
