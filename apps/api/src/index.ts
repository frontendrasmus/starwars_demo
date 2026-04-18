import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { chatRoute } from "./routes/chat.js";
import { MODELS } from "./config/models.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    // `x-model-id` is our custom model-selection header — must be allowed,
    // otherwise the browser will block the preflight.
    allowHeaders: ["Content-Type", "x-model-id"],
  }),
);

app.get("/", (c) => c.text("chat-demo-v1 api · POST /api/chat to talk"));

// The UI calls this on mount to populate its model picker. Keeping the
// list server-side means the UI can't claim models we don't support.
app.get("/api/models", (c) => c.json({ models: MODELS }));

app.route("/api/chat", chatRoute);

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🔥 api listening on http://localhost:${info.port}`);
});
