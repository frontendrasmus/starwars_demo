import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import type { ModelId, PromptId } from "@chat-demo/shared";
import { resolveModel } from "../providers/index.js";
import { resolvePrompt } from "../prompts/registry.js";
import { selectTools } from "../tools/index.js";

export interface RunChatInput {
  messages: UIMessage[];
  modelId: ModelId;
  promptId: PromptId;
}

/**
 * Build the full prompt, run the model with the tools this prompt is
 * allowed to use, return a StreamTextResult.
 *
 * Two v3 changes from v2 that are worth pointing out on stage:
 *
 * 1. `tools` is the subset of the global tool registry that the chosen
 *    prompt has been granted access to. The "writing coach" prompt
 *    declares no tools, so the model sees no tools and physically
 *    cannot call any. Capabilities follow personality.
 *
 * 2. `stopWhen: stepCountIs(5)` enables multi-step generation. Without
 *    this, streamText finishes as soon as the model emits a tool call
 *    — the user sees the call, but never the response that uses the
 *    result. Five steps is generous for a demo: tool call, tool result,
 *    follow-up reply, room for one more round-trip if needed.
 */
export async function runChat({ messages, modelId, promptId }: RunChatInput) {
  const model = resolveModel(modelId);
  const prompt = resolvePrompt(promptId);
  const tools = selectTools(prompt.tools);
  const modelMessages = await convertToModelMessages(messages);

  return streamText({
    model,
    system: prompt.system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(5),
  });
}
