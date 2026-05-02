import { tool } from "ai";
import { z } from "zod";
import { search } from "../knowledge/store.js";


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
