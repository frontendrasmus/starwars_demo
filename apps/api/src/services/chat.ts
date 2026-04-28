import { convertToModelMessages, streamText, type UIMessage } from "ai";
import type { ModelId, PromptId } from "@chat-demo/shared";
import { resolveModel } from "../providers/index.js";
import { resolvePrompt } from "../prompts/registry.js";

export interface RunChatInput {
  messages: UIMessage[];
  modelId: ModelId;
  promptId: PromptId;
}

/**
 * Build the full prompt, run the model, return a StreamTextResult.
 *
 * This is where the backend actually earns its keep:
 *   - we pick the model
 *   - we pick the system prompt from our own registry (no trusting the client)
 *   - we translate the UIMessage wire format to the model's input format
 *   - (later) we inject tools, retrieved context, usage logging, etc.
 *
 * Note the deliberate omission of any systemOverride parameter. The UI's
 * AssistantChatTransport forwards a `system` field in the body, but we
 * ignore it — the whole point of this architecture is that system prompts
 * are a backend concern, not something the client can set.
 */
export async function runChat({ messages, modelId, promptId }: RunChatInput) {
  const model = resolveModel(modelId);
  const prompt = resolvePrompt(promptId);
  const modelMessages = await convertToModelMessages(messages);

  return streamText({
    model,
    system: prompt.system,
    messages: modelMessages,
  });
}
