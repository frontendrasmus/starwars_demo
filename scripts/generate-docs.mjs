#!/usr/bin/env node
/**
 * generate-docs.mjs
 *
 * 1. Walks apps/ and packages/ for all .ts/.tsx source files.
 * 2. Sends them ALL in ONE Claude API call (with prompt caching on the
 *    file blob) so Claude can harvest existing comments and code structure
 *    into a coherent DOCS.md.
 * 3. Writes DOCS.md to the project root.
 * 4. Strips every comment from every source file (preserving TS/ESLint
 *    directives) using a state-machine parser — no LLM involved.
 *
 * Usage:
 *   node scripts/generate-docs.mjs            # full run
 *   node scripts/generate-docs.mjs --dry-run  # generate DOCS.md only, skip file rewrite
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY_RUN = process.argv.includes("--dry-run");

const SOURCE_DIRS = ["apps/api/src", "apps/web/src", "packages/shared/src"];
const SOURCE_EXTS = new Set([".ts", ".tsx"]);
const DOCS_OUTPUT = join(ROOT, "DOCS.md");

// Directives that must survive stripping (they affect compilation / linting)
const PRESERVE_RE = /^\/\/\s*(@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable|eslint-enable)/;

// ─── File Discovery ───────────────────────────────────────────────────────────

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else if (SOURCE_EXTS.has(extname(entry.name)) && !entry.name.endsWith(".d.ts")) {
      results.push(full);
    }
  }
  return results;
}

// ─── Comment Stripper ─────────────────────────────────────────────────────────
// State-machine over characters. Handles:
//   - "string" / 'string' literals (respects escapes)
//   - `template ${literals}` with nested ${} depth tracking
//   - // line comments  (stripped unless PRESERVE_RE matches)
//   - /* block */ and /** JSDoc */ comments (always stripped)

function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];

    // ── Quoted string ──────────────────────────────────────────────
    if (ch === '"' || ch === "'") {
      const q = ch;
      out += q; i++;
      while (i < n) {
        const c = src[i];
        if (c === "\\") { out += c + (src[i + 1] ?? ""); i += 2; continue; }
        out += c; i++;
        if (c === q) break;
      }
      continue;
    }

    // ── Template literal ───────────────────────────────────────────
    if (ch === "`") {
      out += ch; i++;
      let depth = 0;
      while (i < n) {
        const c = src[i];
        if (c === "\\") { out += c + (src[i + 1] ?? ""); i += 2; continue; }
        if (c === "$" && src[i + 1] === "{") { out += "${"; i += 2; depth++; continue; }
        if (c === "}" && depth > 0) { out += c; i++; depth--; continue; }
        if (c === "`" && depth === 0) { out += c; i++; break; }
        out += c; i++;
      }
      continue;
    }

    // ── Line comment ───────────────────────────────────────────────
    if (ch === "/" && src[i + 1] === "/") {
      let end = i;
      while (end < n && src[end] !== "\n") end++;
      const comment = src.slice(i, end);
      if (PRESERVE_RE.test(comment)) out += comment; // keep directives
      i = end; // let the \n be consumed on next iteration
      continue;
    }

    // ── Block comment ──────────────────────────────────────────────
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n) {
        if (src[i] === "*" && src[i + 1] === "/") { i += 2; break; }
        i++;
      }
      continue;
    }

    out += ch; i++;
  }

  // Post-pass: trim trailing whitespace per line, collapse 3+ blank lines → 2
  return out
    .split("\n")
    .map((l) => l.trimEnd())
    .reduce((acc, line) => {
      if (
        line === "" &&
        acc.length >= 2 &&
        acc[acc.length - 1] === "" &&
        acc[acc.length - 2] === ""
      ) {
        return acc; // drop third+ consecutive blank line
      }
      acc.push(line);
      return acc;
    }, [])
    .join("\n");
}

// ─── Anthropic API (single batched call + prompt caching) ────────────────────

async function generateDocs(fileMap) {
  // Resolve API key: env var → apps/api/.env fallback
  if (!process.env.ANTHROPIC_API_KEY) {
    try {
      const env = readFileSync(join(ROOT, "apps/api/.env"), "utf-8");
      for (const line of env.split("\n")) {
        const m = line.match(/^ANTHROPIC_API_KEY=(.+)$/);
        if (m) { process.env.ANTHROPIC_API_KEY = m[1].trim(); break; }
      }
    } catch { /* no .env — will fail below with a clear message */ }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not found.\n" +
      "Set it in apps/api/.env or export it in your shell.",
    );
  }

  // Concatenate all files into one block — sent as a single cached message part
  const fileBlob = Object.entries(fileMap)
    .map(([path, src]) => `### ${path}\n\`\`\`typescript\n${src}\n\`\`\``)
    .join("\n\n");

  const systemPrompt = `\
You are a senior software engineer writing technical documentation for a TypeScript monorepo.
Produce a single DOCS.md from the source files provided. Rules:

- Start directly with the top-level # heading — no preamble.
- Include a linked table of contents (markdown anchors).
- Include an Architecture section with a concise text diagram showing data flow.
- Group related source files into logical sections (e.g. "API Routes", "Tools", "Knowledge / RAG").
- For each module: one-paragraph purpose, exported symbols/types (as a table or list), key
  design decisions, and relationships to other modules.
- Use short code snippets (≤10 lines) to illustrate concepts — do not reproduce whole files.
- Write tight, direct prose. No filler. No "this file is responsible for…" boilerplate.
- Output ONLY the markdown. Nothing else.`;

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: [
      // Cache the system prompt — stable across reruns
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: [
          // Cache the file blob — most expensive part; cache hits save ~90% cost on reruns
          {
            type: "text",
            text: `Source files (${Object.keys(fileMap).length} files):\n\n${fileBlob}`,
            cache_control: { type: "ephemeral" },
          },
          // Instruction is NOT cached so we can vary it without busting the cache
          {
            type: "text",
            text: "Generate the complete DOCS.md now.",
          },
        ],
      },
    ],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new Error(`Anthropic API ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Report token usage so the caller can see cache savings
  const u = data.usage ?? {};
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  console.log(
    `  tokens  : ${u.input_tokens ?? "?"} in / ${u.output_tokens ?? "?"} out` +
    (cacheRead || cacheWrite
      ? `\n  cache   : ${cacheRead} read (saved) / ${cacheWrite} written`
      : ""),
  );

  const block = data.content?.[0];
  if (!block || block.type !== "text") {
    throw new Error("Unexpected response shape from Anthropic API");
  }
  return block.text;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const tag = DRY_RUN ? "[dry-run] " : "";
  console.log(`\n${tag}chat-demo-starwars · doc generator\n${"─".repeat(40)}`);

  // 1. Discover source files
  const absFiles = SOURCE_DIRS.flatMap((d) => {
    try { return walk(join(ROOT, d)); }
    catch { return []; }
  });
  console.log(`files     : ${absFiles.length} source files found`);

  // 2. Read + pre-compute stripped versions
  const fileMap = {}; // rel path → { original, stripped }
  for (const abs of absFiles) {
    const rel = relative(ROOT, abs);
    const original = readFileSync(abs, "utf-8");
    fileMap[rel] = { original, stripped: stripComments(original) };
  }

  const changedCount = Object.values(fileMap).filter(
    ({ original, stripped }) => original !== stripped,
  ).length;
  console.log(`comments  : ${changedCount} files contain comments to strip`);

  // 3. Generate DOCS.md — send ORIGINAL files so Claude can harvest comments
  console.log("\ncalling Claude API…");
  const originalMap = Object.fromEntries(
    Object.entries(fileMap).map(([k, v]) => [k, v.original]),
  );
  const docs = await generateDocs(originalMap);
  console.log(`docs size : ${(docs.length / 1024).toFixed(1)} KB`);

  // 4. Write DOCS.md
  writeFileSync(DOCS_OUTPUT, docs.trimEnd() + "\n");
  console.log(`\n✓ DOCS.md written to project root`);

  // 5. Rewrite source files without comments
  if (DRY_RUN) {
    console.log(`  (dry-run: skipped source file rewrite)`);
    return;
  }

  let written = 0;
  for (const abs of absFiles) {
    const rel = relative(ROOT, abs);
    const { original, stripped } = fileMap[rel];
    if (original !== stripped) {
      writeFileSync(abs, stripped);
      written++;
    }
  }
  console.log(`✓ Stripped comments from ${written} files`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
