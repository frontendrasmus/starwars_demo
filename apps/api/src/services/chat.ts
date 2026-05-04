import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import type { ModelId, PromptId } from "@chat-demo/shared";
import { resolveModel } from "../providers/index.js";
import { generateImage } from "../providers/drawthings.js";
import { resolvePrompt } from "../prompts/registry.js";
import { selectTools } from "../tools/index.js";
import { appendMessage } from "../threads/store.js";

export interface DrawThingsOpts {
  steps?: number;
  width?: number;
  height?: number;
}

export interface RunChatInput {
  messages: UIMessage[];
  modelId: ModelId;
  promptId: PromptId;
  drawSettings?: DrawThingsOpts;
  /**
   * If present, the assistant's response message is persisted to this
   * thread when the stream finishes. Caller is responsible for the user
   * message — see routes/chat.ts → persistLatestUserMessage.
   */
  threadId?: string;
}

/**
 * Top-level chat dispatcher. Always returns a Response so the route
 * handler stays trivial. Branches on the model's provider:
 *
 *  - drawthings → manual UI message stream wrapping a txt2img call
 *  - everything else → AI SDK streamText() with tools and multi-step
 */
export async function runChat(input: RunChatInput): Promise<Response> {
  const provider = input.modelId.split("/")[0];
  if (provider === "drawthings") return runImageChat(input);
  return runTextChat(input);
}

async function runTextChat({
  messages,
  modelId,
  promptId,
  threadId,
}: RunChatInput): Promise<Response> {
  const model = resolveModel(modelId);
  const prompt = resolvePrompt(promptId);
  const tools = selectTools(prompt.tools);
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model,
    system: prompt.system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: threadId ? messages : undefined,
    onFinish: threadId
      ? ({ responseMessage }) => persistAssistant(threadId, responseMessage)
      : undefined,
  });
}

/** Pull the most recent user-message text out of the UIMessage history. */
function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  const parts = (last as { parts?: Array<{ type: string; text?: string }> }).parts;
  if (!parts) return "";
  return parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        p.type === "text" && typeof p.text === "string",
    )
    .map((p) => p.text)
    .join("\n")
    .trim();
}

/**
 * Image generation surfaced as a chat turn. We construct the UI-message
 * stream by hand: a status text part while the model thinks, then a
 * file part with the resulting image as a data URL.
 */
async function runImageChat({
  messages,
  drawSettings,
  threadId,
}: RunChatInput): Promise<Response> {
  const prompt = lastUserText(messages);

  const stream = createUIMessageStream({
    originalMessages: threadId ? messages : undefined,
    execute: async ({ writer }) => {
      if (!prompt) {
        const id = generateId();
        writer.write({ type: "text-start", id });
        writer.write({
          type: "text-delta",
          id,
          delta: "Send a prompt describing the image you want generated.",
        });
        writer.write({ type: "text-end", id });
        return;
      }

      const statusId = generateId();
      writer.write({ type: "text-start", id: statusId });
      writer.write({
        type: "text-delta",
        id: statusId,
        delta: `Generating "${prompt}" with Draw Things…`,
      });
      writer.write({ type: "text-end", id: statusId });

      try {
        const { images } = await generateImage(prompt, drawSettings);
        const first = images[0];
        if (!first) throw new Error("Draw Things returned no images");
        writer.write({
          type: "file",
          mediaType: "image/png",
          url: `data:image/png;base64,${first}`,
        });
      } catch (err) {
        const errId = generateId();
        writer.write({ type: "text-start", id: errId });
        writer.write({
          type: "text-delta",
          id: errId,
          delta: `\n\n⚠ ${err instanceof Error ? err.message : "Draw Things failed."}`,
        });
        writer.write({ type: "text-end", id: errId });
      }
    },
    onFinish: threadId
      ? ({ responseMessage }) => persistAssistant(threadId, responseMessage)
      : undefined,
  });

  return createUIMessageStreamResponse({ stream });
}

/** Persist whatever the assistant produced (text + tool calls + files). */
function persistAssistant(threadId: string, msg: UIMessage): void {
  appendMessage({
    // Fall back to a fresh id — the AI SDK occasionally returns "" when
    // we don't pre-seed message ids (which we don't, since assistant-ui
    // owns id generation in the real client).
    id: msg.id || generateId(),
    threadId,
    role: "assistant",
    parts: msg.parts ?? [],
    createdAt: Date.now(),
  });
}
