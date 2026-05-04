import { Hono } from "hono";
import { z } from "zod";
import type { UIMessage } from "ai";
import { DEFAULT_MODEL_ID, isKnownModel } from "../config/models.js";
import { DEFAULT_PROMPT_ID } from "../prompts/registry.js";
import { runChat } from "../services/chat.js";
import { appendMessage, getThread } from "../threads/store.js";

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
  const drawSettings = parseDrawSettings(c.req);

  // Optional thread persistence — if the client sends x-thread-id and the
  // thread exists, we record the latest user message before streaming and
  // the assistant message(s) when the stream finishes. Unknown/missing
  // thread IDs are silently ignored so the route stays backward-compatible.
  const threadIdHeader = c.req.header("x-thread-id");
  const thread = threadIdHeader ? getThread(threadIdHeader) : undefined;
  const threadId = thread?.id;

  if (threadId) {
    persistLatestUserMessage(threadId, parsed.data.messages);
  }

  return await runChat({
    messages: parsed.data.messages as UIMessage[],
    modelId,
    promptId,
    drawSettings,
    threadId,
  });
});

function parseDrawSettings(req: { header: (n: string) => string | undefined }) {
  const num = (h: string) => {
    const v = req.header(h);
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    steps: num("x-drawthings-steps"),
    width: num("x-drawthings-width"),
    height: num("x-drawthings-height"),
  };
}

/**
 * The frontend resends the entire history on every turn. Persist the LAST
 * user message — earlier ones were already saved on prior turns, and
 * appendMessage is upsert-by-id so re-saves would be idempotent anyway.
 */
function persistLatestUserMessage(threadId: string, raw: unknown[]): void {
  for (let i = raw.length - 1; i >= 0; i--) {
    const m = raw[i] as { role?: unknown; id?: unknown; parts?: unknown };
    if (m?.role !== "user") continue;
    const id = typeof m.id === "string" ? m.id : crypto.randomUUID();
    const parts = Array.isArray(m.parts) ? m.parts : [];
    appendMessage({
      id,
      threadId,
      role: "user",
      parts,
      createdAt: Date.now(),
    });
    return;
  }
}
