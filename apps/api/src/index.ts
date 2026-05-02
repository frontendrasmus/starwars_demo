

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ override: true });

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { chatRoute } from "./routes/chat.js";
import { knowledgeRoute } from "./routes/knowledge.js";
import { MODELS } from "./config/models.js";
import { publicPrompts } from "./prompts/registry.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",


    allowHeaders: ["Content-Type", "x-model-id", "x-prompt-id"],
  }),
);

app.get("/", (c) => c.text("chat-demo-v4 api · POST /api/chat to talk"));


app.get("/api/models", (c) => c.json({ models: MODELS }));
app.get("/api/prompts", (c) => c.json({ prompts: publicPrompts() }));

app.route("/api/chat", chatRoute);
app.route("/api/knowledge", knowledgeRoute);

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🔥 api listening on http://localhost:${info.port}`);
});
