import type { ModelDescriptor, ModelId } from "@chat-demo/shared";


export const MODELS: ModelDescriptor[] = [
  { id: "anthropic/claude-opus-4-7", label: "Claude Opus 4.7", provider: "anthropic" },
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "openai/gpt-5", label: "GPT-5", provider: "openai" },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "drawthings/local", label: "Draw Things (local image gen)", provider: "drawthings" },
];

export const DEFAULT_MODEL_ID: ModelId = "anthropic/claude-opus-4-7";

export function isKnownModel(id: string): id is ModelId {
  return MODELS.some((m) => m.id === id);
}
