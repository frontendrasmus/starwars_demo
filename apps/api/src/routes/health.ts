/**
 * Liveness checks for local-process providers the UI cares about.
 *
 *   GET /api/health/drawthings  →  { ok: true } | { ok: false, error }
 *   GET /api/health/ollama      →  { ok: true, models? } | { ok: false, error }
 *
 * Called by the frontend whenever the user picks a local model from the
 * dropdown, so we can surface a friendly error in the chat before they
 * wait for a generation to time out.
 */

import { Hono } from "hono";
import { pingDrawThings } from "../providers/drawthings.js";
import { pingOllama } from "../providers/ollama.js";

export const healthRoute = new Hono();

healthRoute.get("/drawthings", async (c) => {
  return c.json(await pingDrawThings());
});

healthRoute.get("/ollama", async (c) => {
  return c.json(await pingOllama());
});
