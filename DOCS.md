# Chat Demo v4 — Technical Documentation

## Table of Contents

- [Architecture](#architecture)
- [Shared Package](#shared-package)
- [API Entry Point & Configuration](#api-entry-point--configuration)
- [Providers](#providers)
- [Prompts Registry](#prompts-registry)
- [Tools](#tools)
- [Knowledge / RAG](#knowledge--rag)
- [API Routes](#api-routes)
- [Chat Service](#chat-service)
- [Web Application](#web-application)
  - [App Shell](#app-shell)
  - [Chat Component](#chat-component)
  - [Knowledge Panel](#knowledge-panel)
  - [Tool Renderers (Toolkit)](#tool-renderers-toolkit)

---

## Architecture

```
Browser (Vite + React)
│
│  GET /api/models, /api/prompts   ← model + prompt pickers
│  POST /api/chat (stream)         ← x-model-id, x-prompt-id headers
│  GET|POST|DELETE /api/knowledge  ← document management
│
Hono API Server
│
├── config/models      → ModelId registry
├── prompts/registry   → system prompts + per-prompt tool allowlists
├── providers/         → resolveModel(ModelId) → AI SDK LanguageModel
│       ├── anthropic.ts
│       └── openai.ts
├── services/chat.ts   → streamText(model, system, tools, messages)
│       └── tools/     → calculate | getCurrentTime | searchKnowledge
│                                                        │
└── knowledge/                                           │
        ├── embedder.ts  (transformers.js / ONNX)        │
        └── store.ts  ←─── in-memory vector index ───────┘
                          addDocument / search (cosine sim)

packages/shared  ←── ModelId, ModelDescriptor, PromptId, PromptDescriptor
                      imported by both api and web
```

Data flows for a chat turn:

1. Browser sends `POST /api/chat` with `UIMessage[]` and headers `x-model-id` / `x-prompt-id`.
2. `chatRoute` validates the body, resolves IDs to defaults if unknown.
3. `runChat` resolves the model via `providers/index`, fetches the prompt + its tool allowlist, calls `streamText`.
4. If the model calls `searchKnowledge`, `store.search` embeds the query locally and returns ranked chunks — no external call.
5. `streamText` streams the UI message delta back to the browser. `assistant-ui` renders it, routing tool-call parts through the `toolkit` renderers.

---

## Shared Package

**`packages/shared/src/index.ts`**

Single source of truth for types shared between the API and the web app. Kept deliberately thin — the AI SDK's own `UIMessage` type is used directly where needed rather than re-exported here.

| Symbol | Kind | Description |
|---|---|---|
| `ModelId` | `type` | Template literal `"${provider}/${model-name}"` |
| `ModelDescriptor` | `interface` | `{ id, label, provider }` — drives UI picker |
| `PromptId` | `type` | `string` alias for prompt identifiers |
| `PromptDescriptor` | `interface` | `{ id, label, description, tools[] }` — public prompt shape |

The `tools` array on `PromptDescriptor` is shared intentionally: the backend uses it to filter the tool registry; the frontend uses it to render the header hint. Both derive behaviour from the same data.

---

## API Entry Point & Configuration

### `apps/api/src/index.ts`

Bootstraps a Hono application, registers middleware (CORS, logger), mounts routes, and starts the Node.js HTTP server. `dotenv` is loaded with `override: true` as the very first operation so that shell-level empty env vars don't shadow `.env` values.

Custom headers `x-model-id` and `x-prompt-id` are explicitly listed in `allowHeaders` — without this the browser's CORS preflight rejects them.

The `/api/models` and `/api/prompts` endpoints expose the server's registries so the UI can build its pickers from a single source of truth rather than duplicating the list.

### `apps/api/src/config/models.ts`

Declares every model the backend will accept. Exports:

| Symbol | Description |
|---|---|
| `MODELS` | `ModelDescriptor[]` — the canonical list |
| `DEFAULT_MODEL_ID` | Fallback when the client sends an unknown ID |
| `isKnownModel(id)` | Type-guard used by the chat route to reject spoofed IDs |

IDs follow `"provider/model-name"`. The `providers/index` layer splits on `/` to dispatch to the right SDK client. **IDs must remain stable** — the frontend echoes them back on every request.

---

## Providers

### `apps/api/src/providers/index.ts`

The encapsulation boundary between the rest of the API and LLM SDKs. No other module imports `@ai-sdk/anthropic` or `@ai-sdk/openai` directly.

```ts
export function resolveModel(id: ModelId): LanguageModel {
  const provider = id.slice(0, id.indexOf("/"));
  const modelName = id.slice(id.indexOf("/") + 1);
  switch (provider) {
    case "anthropic": return anthropicModel(modelName);
    case "openai":    return openaiModel(modelName);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}
```

Adding a new provider or routing via an AI gateway is a single-file change here.

### `apps/api/src/providers/anthropic.ts`

Wraps `@ai-sdk/anthropic`. Pins `baseURL` to `https://api.anthropic.com/v1` to prevent a misconfigured `ANTHROPIC_BASE_URL` env var from silently misrouting requests. `ANTHROPIC_API_KEY` is read from the environment by the SDK.

### `apps/api/src/providers/openai.ts`

Thin wrapper around `@ai-sdk/openai`. Reads `OPENAI_API_KEY` from the environment automatically.

---

## Prompts Registry

**`apps/api/src/prompts/registry.ts`**

Defines three system-prompt personalities and the tools each is allowed to call. This is the architectural centrepiece of v4: capabilities are co-located with personality, not scattered across request handlers.

| Export | Description |
|---|---|
| `PROMPTS` | Full `PromptEntry[]` including `system` text (server-only) |
| `DEFAULT_PROMPT_ID` | `"default"` |
| `resolvePrompt(id)` | Returns matching entry or falls back to `PROMPTS[0]` |
| `publicPrompts()` | Strips `system` text; safe to send to the browser |

The three built-in prompts:

| ID | Label | Tools |
|---|---|---|
| `default` | General assistant | `calculate`, `getCurrentTime`, `searchKnowledge` |
| `sql` | SQL assistant | _(none)_ |
| `coach` | Writing coach | _(none)_ |

`publicPrompts()` deliberately omits the `system` field — the prompt text is backend IP and sending it would defeat server-side prompt management. The `tools` array is included so the UI can render an accurate hint.

---

## Tools

### `apps/api/src/tools/index.ts`

The global tool registry and the gate that enforces per-prompt restrictions.

```ts
export const TOOLS = {
  calculate,
  getCurrentTime,
  searchKnowledge,
} as const satisfies Record<string, Tool>;

export function selectTools(allowed: readonly string[]): Record<string, Tool> {
  // Only keys present in `allowed` are returned — the model never sees
  // tools it hasn't been granted.
}
```

Adding a tool requires four files: a new `tools/*.ts`, an entry in `TOOLS`, a renderer in `apps/web/src/tools/toolkit.ts`, and an allowance in one or more `PROMPTS` entries.

### `apps/api/src/tools/calculate.ts`

Evaluates arithmetic expressions via `new Function()`. Input is validated against `/^[\d+\-*/().\s]+$/` before execution to prevent code injection. Returns a discriminated union `{ ok: true, expression, value } | { ok: false, error }`.

### `apps/api/src/tools/get-current-time.ts`

Returns the current time using `Intl.DateTimeFormat` with an optional IANA timezone parameter. Safe to call without a timezone (falls back to server local).

### `apps/api/src/tools/search-knowledge.ts`

Agentic RAG tool. The model decides when to call it, formulates its own query, and receives back up to `k` ranked snippets with source labels. Uses `store.search` internally.

Design rationale over automatic context injection: query is often more focused than the user's literal message; retrieval only fires when needed; multi-hop questions can drive multiple searches within one turn via `stopWhen: stepCountIs(5)`.

---

## Knowledge / RAG

### `apps/api/src/knowledge/embedder.ts`

Singleton local sentence embedder using `@huggingface/transformers` (ONNX runtime).

| Export | Description |
|---|---|
| `EMBEDDING_DIM` | `384` — dimensionality of `Xenova/all-MiniLM-L6-v2` |
| `embed(texts)` | Batch-embeds texts; returns unit-length `Float32Array[]` |
| `dot(a, b)` | Dot product — equivalent to cosine similarity on normalised vectors |

The static top-level import (not dynamic `await import()`) is required to ensure Node.js resolves the `node` export condition in the transformers package rather than the web bundle. The pipeline is constructed once and cached in `extractorPromise`. Cold start on first call takes a few seconds while the ~25 MB model downloads; subsequent calls are fast.

Document content **never leaves this process** for indexing or search — only snippets the model chooses to include end up in the prompt sent to Anthropic/OpenAI.

### `apps/api/src/knowledge/store.ts`

In-memory vector store. Resets on server restart (intentional for demo; noted as the swap point for `sqlite-vec` / `pgvector` in production).

| Export | Description |
|---|---|
| `addDocument(source, text)` | Chunks text, batch-embeds, appends to store |
| `listSources()` | Grouped summary by source label |
| `clearStore()` | Empties the store |
| `search(query, k)` | Embeds query, linear cosine scan, returns top-`k` hits |

The chunker splits on blank lines, groups paragraphs into 200–800 character chunks, and hard-splits oversized paragraphs. Linear scan is acceptable for demo-scale data; an ANN index would be the production replacement.

```ts
// Cosine search — dot product valid because embed() normalises vectors
const scored = chunks.map((chunk) => ({
  ...chunk,
  score: dot(queryEmbedding, chunk.embedding),
}));
scored.sort((a, b) => b.score - a.score);
return scored.slice(0, k);
```

---

## API Routes

### `apps/api/src/routes/chat.ts`

`POST /api/chat` — receives `{ messages }` from `AssistantChatTransport`, reads `x-model-id` and `x-prompt-id` from headers, delegates to `runChat`, and streams the result back.

`system` and `tools` fields from the body are intentionally ignored — the server owns prompt and tool selection, not the client.

Unknown model/prompt IDs fall back to defaults rather than returning an error, ensuring a stale browser tab never gets a 400.

### `apps/api/src/routes/knowledge.ts`

Three endpoints for the knowledge base:

| Method | Path | Action |
|---|---|---|
| `GET` | `/api/knowledge` | `listSources()` — grouped summary |
| `POST` | `/api/knowledge` | `{ source, text }` → `addDocument()` |
| `DELETE` | `/api/knowledge` | `clearStore()` |

Body is validated with Zod (`source` max 120 chars, `text` 20–200,000 chars). The route is text-only by design; the comment in the source gives the two-line path to multipart file upload.

---

## Chat Service

**`apps/api/src/services/chat.ts`**

Orchestrates a single chat turn. The only caller is `chatRoute`.

```ts
export async function runChat({ messages, modelId, promptId }: RunChatInput) {
  const model  = resolveModel(modelId);
  const prompt = resolvePrompt(promptId);
  const tools  = selectTools(prompt.tools);  // capability gate
  return streamText({
    model, system: prompt.system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),               // multi-step tool use
  });
}
```

`stopWhen: stepCountIs(5)` enables multi-step generation: without it `streamText` halts after emitting a tool call and the user never sees the reply that uses the result. Five steps allows tool call → result → reply with room for follow-up round-trips.

**Depends on:** `providers/index`, `prompts/registry`, `tools/index`.

---

## Web Application

### App Shell

**`apps/web/src/App.tsx`**

Fetches `/api/models` and `/api/prompts` on mount, renders model and prompt `<select>` pickers, and mounts `<Chat>` once both selections are available. Also mounts `<KnowledgePanel>` in the header.

`activePromptTools` is derived from the selected prompt's `tools` array (from `PromptDescriptor`) and rendered as a plain-text hint so the user can see which tools are active without opening any panel.

`<Chat>` receives a compound `key={modelId::promptId}`. Changing either picker unmounts and remounts the component, starting a fresh thread. This prevents cross-persona confusion and ensures the transport is reconstructed with the new headers.

**`apps/web/src/main.tsx`**

Standard React 18 `createRoot` entry point. Renders `<App>` inside `StrictMode`.

### Chat Component

**`apps/web/src/components/Chat.tsx`**

Builds an `AssistantChatTransport` with `x-model-id` and `x-prompt-id` headers, wires it into `useChatRuntime`, and provides it to `AssistantRuntimeProvider`. Tool renderers are registered via `useAui({ tools: Tools({ toolkit }) })`.

The `Thread` function composes the UI from `assistant-ui` primitives (`ThreadPrimitive`, `MessagePrimitive`, `ComposerPrimitive`) rather than using the pre-built styled `<Thread />` that was removed in `@assistant-ui/react` 0.12.

Tool-call parts inside `MessagePrimitive.Parts` are routed automatically to the matching renderer in `toolkit`. Renderers for tools the current prompt cannot call are harmless — they simply never fire.

### Knowledge Panel

**`apps/web/src/components/KnowledgePanel.tsx`**

Collapsible panel in the header. Fetches `GET /api/knowledge` on mount and after each mutation. Submits `{ source, text }` via `POST /api/knowledge`. Clears the store via `DELETE /api/knowledge` with a confirmation dialog.

Paste-in only (no file `<input>`) for v4. The component notes that real file upload is a ~20-line backend addition.

### Tool Renderers (Toolkit)

**`apps/web/src/tools/toolkit.tsx`**

Maps tool names to `assistant-ui` renderer objects. Each renderer handles three states: running (spinner), error (`ok: false`), and success (`ok: true`).

| Tool key | Result type | Renders |
|---|---|---|
| `calculate` | `{ ok, expression, value }` | Expression and numeric result |
| `getCurrentTime` | `{ ok, formatted, timezone }` | Formatted date/time + timezone label |
| `searchKnowledge` | `{ ok, query, hits[] }` | Hit list with source label, score, and snippet |

Tool names must match exactly the keys in `apps/api/src/tools/index.ts` — a mismatch causes `assistant-ui` to fall back to raw JSON display, which serves as a useful debugging signal. Inline SVG icons (no icon library dependency) are included for each tool.
