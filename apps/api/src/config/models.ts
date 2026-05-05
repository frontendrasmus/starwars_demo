import type { ModelDescriptor, ModelId } from "@chat-demo/shared";


export const MODELS: ModelDescriptor[] = [
  { id: "anthropic/claude-opus-4-7", label: "Claude Opus 4.7", provider: "anthropic" },
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "openai/gpt-5", label: "GPT-5", provider: "openai" },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "drawthings/local", label: "Draw Things (local image gen)", provider: "drawthings" },
  { id: "ollama/llama3.2:3b", label: "Llama 3.2 3B (local · Ollama)", provider: "ollama" },
  { id: "ollama/gemma4:latest", label: "Gemma 4 (local · Ollama)", provider: "ollama" },
];

export const DEFAULT_MODEL_ID: ModelId = "anthropic/claude-opus-4-7";

export function isKnownModel(id: string): id is ModelId {
  return MODELS.some((m) => m.id === id);
}
