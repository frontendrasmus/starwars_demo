/**
 * Routes for the per-user thread list.
 *
 *   GET    /api/threads          → metadata for sidebar
 *   POST   /api/threads          → create empty thread (model+prompt frozen at this moment)
 *   GET    /api/threads/:id      → { thread, messages } for rehydration
 *   PATCH  /api/threads/:id      → rename / archive
 *   DELETE /api/threads/:id      → wipe
 */

import { Hono } from "hono";
import { z } from "zod";
import { DEFAULT_MODEL_ID, isKnownModel } from "../config/models.js";
import { DEFAULT_PROMPT_ID } from "../prompts/registry.js";
import {
  createThread,
  deleteThread,
  getMessages,
  getThread,
  listThreads,
  updateThread,
} from "../threads/store.js";

export const threadsRoute = new Hono();

threadsRoute.get("/", (c) => {
  const includeArchived = c.req.query("archived") === "1";
  return c.json({ threads: listThreads({ includeArchived }) });
});

const CreateBody = z.object({
  modelId: z.string().optional(),
  promptId: z.string().optional(),
});

threadsRoute.post("/", async (c) => {
  const parsed = CreateBody.safeParse(await c.req.json().catch(() => ({})));
  const body = parsed.success ? parsed.data : {};

  const requestedModel = body.modelId ?? DEFAULT_MODEL_ID;
  const modelId = isKnownModel(requestedModel) ? requestedModel : DEFAULT_MODEL_ID;
  const promptId = body.promptId ?? DEFAULT_PROMPT_ID;

  const thread = createThread({ modelId, promptId });
  return c.json(thread, 201);
});

threadsRoute.get("/:id", (c) => {
  const id = c.req.param("id");
  const thread = getThread(id);
  if (!thread) return c.json({ error: "Thread not found" }, 404);
  return c.json({ thread, messages: getMessages(id) });
});

const PatchBody = z.object({
  title: z.string().min(1).max(120).optional(),
  archived: z.boolean().optional(),
});

threadsRoute.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const parsed = PatchBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid body" }, 400);

  const updated = updateThread(id, parsed.data);
  if (!updated) return c.json({ error: "Thread not found" }, 404);
  return c.json(updated);
});

threadsRoute.delete("/:id", (c) => {
  const id = c.req.param("id");
  const ok = deleteThread(id);
  if (!ok) return c.json({ error: "Thread not found" }, 404);
  return c.json({ ok: true });
});
