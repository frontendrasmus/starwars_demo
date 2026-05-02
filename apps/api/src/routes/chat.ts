import { Hono } from "hono";
import { z } from "zod";
import type { UIMessage } from "ai";
import { DEFAULT_MODEL_ID, isKnownModel } from "../config/models.js";
import { DEFAULT_PROMPT_ID } from "../prompts/registry.js";
import { runChat } from "../services/chat.js";


const BodySchema = z.object({
  messages: z.array(z.unknown()),
  system: z.string().optional(),
  tools: z.unknown().optional(),
});

export const chatRoute = new Hono();

chatRoute.post("/", async (c) => {
  const parsed = BodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      400,
    );
  }

  const requestedModel = c.req.header("x-model-id") ?? DEFAULT_MODEL_ID;
  const modelId = isKnownModel(requestedModel) ? requestedModel : DEFAULT_MODEL_ID;
  const promptId = c.req.header("x-prompt-id") ?? DEFAULT_PROMPT_ID;

  const result = await runChat({
    messages: parsed.data.messages as UIMessage[],
    modelId,
    promptId,
  });

  return result.toUIMessageStreamResponse();
});
