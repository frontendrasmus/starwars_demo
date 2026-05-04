/**
 * Wire types shared between the API and the web app. Keep this file
 * intentionally thin — only types that cross the HTTP boundary live here.
 */

export type ModelId = `${string}/${string}`;

export interface ModelDescriptor {
  id: ModelId;
  label: string;
  provider: "anthropic" | "openai" | "drawthings";
}

export type PromptId = string;

export interface PromptDescriptor {
  id: PromptId;
  label: string;
  description: string;
  /** Tool names this prompt is allowed to invoke; double duty as a UI hint. */
  tools: string[];
}

/**
 * Lightweight thread metadata returned by GET /api/threads.
 * The full message history is fetched separately via GET /api/threads/:id
 * so the sidebar can stay snappy even with hundreds of threads.
 */
export interface ThreadDescriptor {
  id: string;
  /** Substring of the first user message; auto-set on first append. */
  title: string;
  /** The model the thread was started with — frozen for thread lifetime. */
  modelId: ModelId;
  promptId: PromptId;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  /** Cheap counter used by the sidebar to hide empty threads. */
  messageCount: number;
}

/**
 * One persisted message. We store the raw assistant-ui parts array (not
 * just text) so reloading a thread rehydrates tool-call cards, generated
 * images, etc. with full fidelity.
 */
export interface PersistedMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  /** Opaque to the backend — pass through to the frontend on load. */
  parts: unknown[];
  createdAt: number;
}
