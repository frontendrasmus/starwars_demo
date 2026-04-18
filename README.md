# Chat demo — v1

A minimal but architecturally honest chat UI. The point of the demo is the
_middle tier_: a TypeScript backend that encapsulates prompts, provider
selection, and context, standing between the React UI and the LLM APIs.

## Stack

- **Frontend** — React 19 + Vite + `assistant-ui` (with its AI SDK runtime)
- **Backend** — Hono on Node, with `@hono/node-server`
- **AI layer** — Vercel AI SDK v6 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`)
- **Transport** — AI SDK's UI message stream protocol end-to-end

## Layout

```
apps/
  api/              Hono backend
    src/
      index.ts        Bootstrap: CORS, logger, routes
      routes/chat.ts  POST /api/chat — parse, validate, stream
      services/chat.ts  Build prompt, call model (the slide-worthy file)
      providers/      ModelId → AI SDK LanguageModel
      prompts/        System prompt(s)
      config/         Model registry
  web/              React + Vite frontend
    src/
      App.tsx               Model picker + layout
      components/Chat.tsx   assistant-ui runtime in ~25 lines
packages/
  shared/           ModelId types, shared between the two apps
```

## Prerequisites

- Node 20+ (an `.nvmrc` is included)
- pnpm 9+ — `npm install -g pnpm`
- An Anthropic and/or OpenAI API key

## Setup

```bash
# 1. Install everything
pnpm install

# 2. Configure the backend
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env and fill in ANTHROPIC_API_KEY / OPENAI_API_KEY

# 3. Configure the frontend (optional — defaults assume localhost:8080)
cp apps/web/.env.example apps/web/.env

# 4. Run both apps in parallel
pnpm dev
```

The API serves on `http://localhost:8080`, the web app on
`http://localhost:5173`.

You can also run them individually: `pnpm dev:api` and `pnpm dev:web`.

## Reading order for the talk

If you're using this as your reference repo on stage, open these files in
roughly this order:

1. `apps/web/src/components/Chat.tsx` — the entire frontend-to-backend
   wiring. Point at the three imports from `@assistant-ui/react-ai-sdk`
   and note that the transport targets _your_ URL, not a model provider's.
2. `apps/api/src/index.ts` — Hono bootstrap. Sub-20 lines. No magic.
3. `apps/api/src/routes/chat.ts` — the HTTP boundary. Shows that the
   backend's input contract is set by `AssistantChatTransport`.
4. `apps/api/src/services/chat.ts` — the money shot. The `runChat`
   function is the answer to "what does the backend actually do?"
5. `apps/api/src/providers/index.ts` — shows the abstraction that lets
   you swap Claude for GPT (or ultimately a local model) by touching
   one file.

## Styling note: assistant-ui is unstyled by default

`<Thread />` from `@assistant-ui/react` expects a Tailwind + shadcn setup
for its default styling. This skeleton ships without those deps, so the
Thread will render _functional but plain_ — messages, composer, send button,
all working, but no chat bubbles or polish.

To get the styled components assistant-ui is known for, run:

```bash
cd apps/web
npx assistant-ui init
```

That command scaffolds Tailwind config, shadcn primitives, and customisable
Thread components into your `src/components/`. Once that's done, replace
the `Thread` import in `Chat.tsx` with the local scaffolded version.

Docs: [assistant-ui.com/docs](https://www.assistant-ui.com/docs).

## Roadmap

This repo is `v1`. The architecture was chosen with later iterations in
mind — each step below should touch one or two files, not the whole tree.

- **v1 (this)** — streaming chat, model picker, one system prompt
- **v2** — prompt variants (`/api/chat` accepts a `promptVariant`), server-side
  pre/post processing, rate-limit middleware
- **v3** — server-defined tools (calculator, `fetchWeather`) rendered in
  assistant-ui's built-in tool-call UI. Tools live in `services/tools/`.
- **v4** — retrieval: file upload endpoint, embed + store, inject snippets
  into the system message in `services/chat.ts`
- **v5** — thread persistence with SQLite + Drizzle; assistant-ui's thread
  primitives on the client

## Troubleshooting

**"Could not reach API" banner on page load.** The backend isn't running.
Start it with `pnpm dev:api` and check `http://localhost:8080` returns text.

**CORS errors in the browser console.** Set `CORS_ORIGIN` in `apps/api/.env`
to whichever origin your browser is using (e.g. `http://127.0.0.1:5173`
versus `http://localhost:5173`).

**Peer-dependency warnings on install.** The AI SDK and assistant-ui
release on different cadences; peer ranges occasionally lag behind.
`pnpm install` usually resolves cleanly, but if it doesn't, run
`pnpm up --latest` in the offending app and report back what worked —
the version pins in this skeleton are deliberately conservative.

**Model says it's something other than what's in the picker.** Expected.
Models often don't know their own version string, and the system prompt
here doesn't tell them. That's a v2 concern (inject model metadata into
the system prompt).
