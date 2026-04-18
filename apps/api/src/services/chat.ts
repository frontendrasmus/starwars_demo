import { convertToModelMessages, streamText, type UIMessage } from "ai";
import type { ModelId } from "@chat-demo/shared";
import { resolveModel } from "../providers/index.js";
import { SYSTEM_PROMPT } from "../prompts/system.js";

export interface RunChatInput {
  messages: UIMessage[];
  modelId: ModelId;
  /**
   * Optional system string forwarded by assistant-ui's AssistantChatTransport.
   * In v1 we ignore it and always use our own SYSTEM_PROMPT — the whole point
   * of owning a backend is that prompts are a server-side concern. In v2 this
   * becomes a named-variant selector ("sql-assistant", "writing-coach", ...).
   */
  systemOverride?: string;
}

/**
 * Build the full prompt, run the model, and return a StreamTextResult.
 * The route layer calls .toUIMessageStreamResponse() to turn it into HTTP.
 *
 * This is where the backend actually earns its keep:
 *   - we pick the model
 *   - we own the system prompt (no trusting the client)
 *   - we translate the UIMessage wire format to the model's input format
 *   - (later) we inject tools, retrieved context, usage logging, etc.
 */
export async function runChat({ messages, modelId }: RunChatInput) {
  const model = resolveModel(modelId);
  const modelMessages = await convertToModelMessages(messages);

  return streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: modelMessages,
  });
}
