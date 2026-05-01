import { tool } from "ai";
import { z } from "zod";

export const getCurrentTime = tool({
  description:
    "Get the current date and time, optionally in a specific IANA timezone. Use this when the user asks for the current time, today's date, or anything time-relative.",
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .describe(
        "An IANA timezone like 'Europe/Stockholm' or 'America/New_York'. If omitted, uses the server's local timezone.",
      ),
  }),
  execute: async ({ timezone }) => {
    const now = new Date();
    try {
      const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        dateStyle: "full",
        timeStyle: "long",
      });
      const formatted = formatter.format(now);
      const resolvedTimezone =
        timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      return {
        ok: true as const,
        iso: now.toISOString(),
        formatted,
        timezone: resolvedTimezone,
      };
    } catch (err) {
      return {
        ok: false as const,
        error:
          err instanceof Error ? err.message : "Could not resolve timezone.",
      };
    }
  },
});
