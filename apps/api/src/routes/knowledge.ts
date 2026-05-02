import { Hono } from "hono";
import { z } from "zod";
import {
  addDocument,
  clearStore,
  listSources,
} from "../knowledge/store.js";


const PostBody = z.object({
  source: z
    .string()
    .min(1)
    .max(120)
    .describe("Human-readable source label, e.g. a filename or URL."),
  text: z.string().min(20).max(200_000),
});

export const knowledgeRoute = new Hono();

knowledgeRoute.get("/", (c) => c.json({ sources: listSources() }));

knowledgeRoute.post("/", async (c) => {
  const parsed = PostBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      400,
    );
  }
  const result = await addDocument(parsed.data.source, parsed.data.text);
  return c.json(result);
});

knowledgeRoute.delete("/", (c) => {
  clearStore();
  return c.json({ ok: true });
});
