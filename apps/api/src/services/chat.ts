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
