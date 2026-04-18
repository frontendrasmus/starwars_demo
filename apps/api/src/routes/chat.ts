import { Hono } from "hono";
import { z } from "zod";
import type { UIMessage } from "ai";
import { DEFAULT_MODEL_ID, isKnownModel } from "../config/models.js";
import { runChat } from "../services/chat.js";

/**
 * POST /api/chat
 *
 * Body shape is dictated by assistant-ui's AssistantChatTransport, which
 * forwards { messages, system?, tools? }. We validate loosely here — the
 * AI SDK's convertToModelMessages() does the real UIMessage validation
 * downstream, and re-asserting it in Zod would duplicate that schema.
 *
 * Model selection rides on the `x-model-id` header rather than the body
 * because AssistantChatTransport owns the body shape. Alternative: use
 * `sendExtraMessageFields` on the transport to merge it in.
 */
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

  const requested = c.req.header("x-model-id") ?? DEFAULT_MODEL_ID;
  const modelId = isKnownModel(requested) ? requested : DEFAULT_MODEL_ID;

  const result = await runChat({
    messages: parsed.data.messages as UIMessage[],
    modelId,
    systemOverride: parsed.data.system,
  });

  // toUIMessageStreamResponse returns a Web Response, which Hono returns
  // from a handler directly. No hono/streaming wrapper needed.
  return result.toUIMessageStreamResponse();
});
