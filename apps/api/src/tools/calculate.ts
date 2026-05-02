import { tool } from "ai";
import { z } from "zod";


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
