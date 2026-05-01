import { tool } from "ai";
import { z } from "zod";

/**
 * The set of characters allowed in a math expression. Restricting input
 * before passing to Function() defends against arbitrary code execution —
 * the model has tried to call .toString().constructor(...) and similar
 * tricks in the wild before, so this regex is non-negotiable in production.
 *
 * For a real product, prefer a dedicated parser like mathjs. We use
 * Function() here so the demo has zero dependencies for this tool.
 */
const SAFE_EXPRESSION = /^[\d+\-*/().\s]+$/;

export const calculate = tool({
  description:
    "Evaluate a basic arithmetic expression. Supports +, -, *, /, parentheses, and decimal numbers. Use this when the user asks for a calculation.",
  inputSchema: z.object({
    expression: z
      .string()
      .describe("The arithmetic expression to evaluate, e.g. '(12 + 3) * 4'"),
  }),
  execute: async ({ expression }) => {
    if (!SAFE_EXPRESSION.test(expression)) {
      return {
        ok: false as const,
        error: "Expression contains characters that aren't allowed.",
      };
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const value = new Function(`"use strict"; return (${expression});`)();
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { ok: false as const, error: "Expression did not evaluate to a finite number." };
      }
      return { ok: true as const, expression, value };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Unknown evaluation error",
      };
    }
  },
});
