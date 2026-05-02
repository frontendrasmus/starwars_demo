import { tool } from "ai";
import { z } from "zod";
import { search } from "../knowledge/store.js";

/**
 * The agentic-RAG tool: the model decides when to look something up,
 * passes a focused query, and gets back ranked snippets to use in its
 * reply.
 *
 * Why agentic instead of automatic injection?
 *   - The model picks the query (often more focused than the user's
 *     literal message).
 *   - Retrieval only fires when actually needed, saving latency on
 *     small-talk and follow-up questions.
 *   - Multi-hop questions can drive multiple searches in one turn
 *     (the v3 stopWhen: stepCountIs(5) gives us up to 5 round trips).
 *
 * The trade-off is that the model has to decide to call the tool, and
 * sometimes it doesn't. The system prompt nudges it.
 */
export const searchKnowledge = tool({
  description:
    "Search the user's local knowledge base for information relevant to a query. Returns up to k snippets, each with a source label. Use this whenever the user asks about something that might be in their uploaded documents — facts, names, dates, internal terminology. If the search returns nothing, say so.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "A focused search query. Reformulate the user's question into key terms.",
      ),
    k: z
      .number()
      .int()
      .min(1)
      .max(8)
      .default(4)
      .describe("Maximum number of snippets to return."),
  }),
  execute: async ({ query, k }) => {
    const hits = await search(query, k);
    if (hits.length === 0) {
      return {
        ok: true as const,
        query,
        hits: [],
        message:
          "No documents in the knowledge base, or no relevant matches found.",
      };
    }
    return {
      ok: true as const,
      query,
      hits: hits.map((h) => ({
        source: h.source,
        text: h.text,
        score: Number(h.score.toFixed(3)),
      })),
    };
  },
});
