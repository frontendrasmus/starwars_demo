/**
 * Ollama provider — local LLMs via the OpenAI-compatible API at /v1.
 *
 * We piggyback on @ai-sdk/openai with a custom baseURL because the
 * Vercel AI SDK already speaks OpenAI's wire format, and Ollama exposes
 * exactly that shape on http://localhost:11434/v1. No extra package
 * needed; tools, streaming, and multi-step all work out of the box.
 *
 * Override the URL with OLLAMA_URL in apps/api/.env.
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const PING_TIMEOUT_MS = 2000;

// Ollama doesn't require an API key, but @ai-sdk/openai insists on a
// non-empty string. "ollama" is the canonical placeholder.
const ollama = createOpenAI({
  baseURL: `${OLLAMA_URL}/v1`,
  apiKey: "ollama",
});

/**
 * Use the Chat Completions API explicitly (`.chat()`), NOT the default
 * factory which talks to OpenAI's newer Responses API. The Responses
 * API serialises multi-step tool conversations using `item_reference`
 * pointers, and Ollama's compat shim doesn't understand them — which
 * causes turn 2 to silently abort with `input[N]: unknown input item
 * type: "item_reference"`.
 */
export function ollamaModel(modelName: string): LanguageModel {
  return ollama.chat(modelName);
}

export type PingResult =
  | { ok: true; models?: string[] }
  | { ok: false; error: string };

/** Reach out to the local Ollama process and list available models. */
export async function pingOllama(): Promise<PingResult> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `Ollama responded HTTP ${res.status}` };
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return { ok: true, models: (data.models ?? []).map((m) => m.name) };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Cannot reach Ollama at ${OLLAMA_URL} — ${err.message}`
          : `Cannot reach Ollama at ${OLLAMA_URL}`,
    };
  }
}
