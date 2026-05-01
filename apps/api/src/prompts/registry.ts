import type { PromptDescriptor, PromptId } from "@chat-demo/shared";

/**
 * The library of system prompts this backend knows about.
 *
 * Each entry is a self-contained personality with an explicit list of
 * tools it's allowed to call. Tools are gated *here* — if a prompt
 * doesn't list a tool, the chat service will not pass it to the model,
 * so the model literally can't call it. This is the architectural
 * payoff of v3: prompts and capabilities are configured together.
 *
 * Adding a new prompt: add an entry here, nothing else. No route
 * changes, no frontend changes (other than registering renderers for
 * any new tools, which live in the toolkit on the web side).
 */
interface PromptEntry extends PromptDescriptor {
  /** The system prompt sent to the model. Can be multi-line. */
  system: string;
}

export const PROMPTS: PromptEntry[] = [
  {
    id: "default",
    label: "General assistant",
    description: "A helpful generalist with calculator and time tools.",
    tools: ["calculate", "getCurrentTime"],
    system: `You are a helpful assistant in a live demo.
Be concise and direct. If you don't know something, say so plainly.

You have these tools available:
  - calculate(expression): evaluate arithmetic. Use it for any math
    the user asks about, even simple sums — never compute in your head.
  - getCurrentTime(timezone?): get the current date and time. Use it
    whenever the user mentions "now", "today", or asks for the time.

When you call a tool, the result will be added to the conversation.
Read it, then write a natural reply that uses the result. Don't paste
raw JSON to the user.`,
  },
  {
    id: "sql",
    label: "SQL assistant",
    description: "Translates natural language into SQL. No tools.",
    tools: [],
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
    description: "Edits prose for clarity. No tools.",
    tools: [],
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

export function resolvePrompt(id: string | undefined): PromptEntry {
  if (!id) return PROMPTS[0]!;
  return PROMPTS.find((p) => p.id === id) ?? PROMPTS[0]!;
}

/**
 * The public view of the registry — descriptor fields only, no system
 * prompts. We never ship the `system` text to the browser: it's backend
 * IP, and sending it would defeat the entire point of server-side prompts.
 * The `tools` list IS sent so the UI can render a hint about what's
 * available.
 */
export function publicPrompts(): PromptDescriptor[] {
  return PROMPTS.map(({ id, label, description, tools }) => ({
    id,
    label,
    description,
    tools,
  }));
}
