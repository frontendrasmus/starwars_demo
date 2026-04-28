/**
 * Shared types between the API and web app.
 *
 * Deliberately minimal. The chat wire format itself (UIMessage[]) is owned
 * by the AI SDK and imported directly where it's used — no point wrapping it.
 */

/** Identifier for a configured model. Format: "{provider}/{model-name}". */
export type ModelId = `${string}/${string}`;

/** A model entry as shown in the UI model picker. */
export interface ModelDescriptor {
  id: ModelId;
  label: string;
  provider: "anthropic" | "openai";
}

/** Identifier for a system-prompt variant. */
export type PromptId = string;

/** A prompt entry as shown in the UI prompt picker. */
export interface PromptDescriptor {
  id: PromptId;
  label: string;
  /** Short description rendered as the option's title attribute (hover tooltip). */
  description: string;
}
