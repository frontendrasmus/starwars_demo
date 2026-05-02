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

async function runTextChat({ messages, modelId, promptId }: RunChatInput): Promise<Response> {
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
  return result.toUIMessageStreamResponse();
}

/** Pull the most recent user-message text out of the UIMessage history. */
function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  const parts = (last as { parts?: Array<{ type: string; text?: string }> }).parts;
  if (!parts) return "";
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

/**
 * Image generation surfaced as a chat turn. We construct the UI-message
 * stream by hand: a status text part while the model thinks, then a
 * file part with the resulting image as a data URL.
 */
async function runImageChat({ messages, drawSettings }: RunChatInput): Promise<Response> {
  const prompt = lastUserText(messages);

  const stream = createUIMessageStream({
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
  });

  return createUIMessageStreamResponse({ stream });
}
