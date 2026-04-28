import type { PromptDescriptor, PromptId } from "@chat-demo/shared";

/**
 * The library of system prompts this backend knows about.
 *
 * Each entry is a self-contained personality or task definition. The UI
 * fetches the list on mount via /api/prompts, renders a dropdown, and
 * sends the chosen ID back on every request via the x-prompt-id header.
 *
 * Adding a new prompt: add an entry here, nothing else. No route changes,
 * no frontend changes. That's the point — prompts are data, not code.
 *
 * Shape is deliberately flat. In v3, each entry will grow an optional
 * `tools` field naming the server-side tools it's allowed to call.
 */
interface PromptEntry extends PromptDescriptor {
  /** The system prompt sent to the model. Can be multi-line. */
  system: string;
}

export const PROMPTS: PromptEntry[] = [
  {
    id: "default",
    label: "General assistant",
    description: "The v1 baseline — a helpful, concise generalist.",
    system: `You are a helpful assistant in a live demo.
Be concise and direct. If you don't know something, say so plainly.
Format code in fenced blocks. Prefer short examples over long ones.`,
  },
  {
    id: "sql",
    label: "SQL assistant",
    description: "Translates natural language into SQL for a toy e-commerce schema.",
    system: `You are a SQL assistant for a small e-commerce database.

The schema has exactly these tables:
  customers(id, email, created_at)
  orders(id, customer_id, total_cents, created_at)
  order_items(id, order_id, product_id, quantity, unit_price_cents)
  products(id, name, category)

When the user asks a question in natural language, respond with:
  1. A single PostgreSQL query in a fenced code block, and
  2. One short sentence explaining what it does.

Do not explain SQL syntax unless asked. Do not suggest schema changes.
If the question cannot be answered with the schema above, say so and
stop — do not invent columns or tables. Do not answer questions
unrelated to this database; politely redirect to the general assistant.`,
  },
  {
    id: "coach",
    label: "Writing coach",
    description: "Edits prose for clarity. Won't write code.",
    system: `You are a writing coach. The user will paste a sentence,
paragraph, or short passage. Your job:

  1. Quote the original.
  2. Offer one revised version that is clearer and more direct.
  3. In two or three bullet points, explain what you changed and why —
     focusing on weak verbs, passive voice, hedging, and redundancy.

Do not write new content from scratch. Do not write code, even if asked.
If the user hasn't pasted anything to edit, ask them to.`,
  },
];

export const DEFAULT_PROMPT_ID: PromptId = "default";

/**
 * Resolve a prompt ID to its entry. Falls back to the default prompt
 * if the ID is unknown — clients can't force an unregistered prompt,
 * but they also don't get an error if they send a stale one.
 */
export function resolvePrompt(id: string | undefined): PromptEntry {
  if (!id) return PROMPTS[0]!;
  return PROMPTS.find((p) => p.id === id) ?? PROMPTS[0]!;
}

/**
 * The public view of the registry — descriptor fields only, no prompts.
 * We never ship the `system` text to the browser: it's backend IP, and
 * sending it would defeat the entire point of server-side prompts.
 */
export function publicPrompts(): PromptDescriptor[] {
  return PROMPTS.map(({ id, label, description }) => ({ id, label, description }));
}
