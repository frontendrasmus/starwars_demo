/**
 * Tourist-brochure workflow.
 *
 * Three modes, dispatched from a single entry point:
 *
 *  - Discovery (no prior memory in the thread)
 *      overview → [facts ║ hotel ║ contact] → images → draft
 *      → eval/refine loop → emit data-brochure
 *
 *  - Attractions follow-up (prior data-brochure + "attractions" intent)
 *      Read prior BrochureData as memory → attractionsAgent + image
 *      scraping → emit data-attractions
 *
 *  - Costs follow-up (prior data-brochure + "costs" intent)
 *      Read prior BrochureData as memory → costsAgent → emit data-costs
 *
 * Memory pattern (https://ai-sdk.dev/docs/agents/memory): the prior
 * structured output persists in the thread's message history as a
 * `data-brochure` part. We read it back on follow-ups so we don't
 * re-discover what we already know — currency, hotel tier, country,
 * "known for" highlights all flow through.
 */

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type UIMessage,
} from "ai";
import {
  contactAgent,
  draftAgent,
  evalAgent,
  factsAgent,
  hotelAgent,
  imageAgent,
  overviewAgent,
  refineAgent,
} from "./agents.js";
import { attractionsAgent, costsAgent } from "./follow-ups.js";
import { appendMessage } from "../../threads/store.js";
import type { RunChatInput } from "../../services/chat.js";
import type { BrochureData } from "@chat-demo/shared";

const MAX_REFINE = 2;
const PASSING_SCORE = 7;

type FollowUp = "attractions" | "costs";

export async function runTouristBrochureWorkflow(
  input: RunChatInput,
): Promise<Response> {
  const userText = lastUserText(input.messages);
  const priorBrochure = findLatestBrochureData(input.messages);
  const followUp = priorBrochure ? detectFollowUp(userText) : null;

  if (priorBrochure && followUp === "attractions") {
    return runAttractionsFollowUp(input, priorBrochure);
  }
  if (priorBrochure && followUp === "costs") {
    return runCostsFollowUp(input, priorBrochure);
  }
  return runFullDiscovery(input, userText);
}

// ── Mode 1: full discovery ──────────────────────────────────────────────

function runFullDiscovery(input: RunChatInput, city: string): Response {
  const threadId = input.threadId;
  const stream = createUIMessageStream({
    originalMessages: threadId ? input.messages : undefined,
    execute: async ({ writer }) => {
      const log = makeLogger(writer);
      try {
        if (!city) {
          log.line(`⚠ Please name a city. Example: type just 'Lisbon' or 'Reykjavík'.`);
          log.end();
          return;
        }

        log.line(`🔍 Researching ${city}…`);
        const overview = await overviewAgent(city);
        log.line(`   ↳ ${overview.country} · known for: ${overview.knownFor.join(", ")}`);

        log.line(`📊 Gathering facts, hotel, contacts (parallel)…`);
        const [facts, hotel, contact] = await Promise.all([
          factsAgent(city),
          hotelAgent(city),
          contactAgent(city),
        ]);
        log.line(`   ↳ hotel: ${hotel.name} (${hotel.area})`);

        log.line(`🌐 Scraping images from Wikipedia…`);
        const images = await imageAgent(city, overview.country);
        const found: string[] = [];
        if (images.hero) found.push("hero");
        if (images.flag) found.push("flag");
        if (images.citySymbol) found.push("city symbol");
        log.line(found.length === 0
          ? `   ⚠ No images found on Wikipedia. Continuing.`
          : `   ↳ Found: ${found.join(", ")}.`);

        log.line(`✍️  Drafting brochure (Sonnet)…`);
        let draft = await draftAgent({ city, overview, facts, hotel, contact });

        // Eval/refine loop bounded by MAX_REFINE.
        for (let attempt = 1; attempt <= MAX_REFINE + 1; attempt++) {
          log.line(`🔬 Quality check (attempt ${attempt})…`);
          const ev = await evalAgent(draft.markdown);
          log.line(`   ↳ score ${ev.score}/10 · ${describeCriteria(ev.criteria)}`);
          if (ev.passes && ev.score >= PASSING_SCORE) {
            log.line(`   ✓ Passes quality check.`);
            break;
          }
          if (attempt > MAX_REFINE) {
            log.line(`   ⚠ Did not pass after ${MAX_REFINE} refinements — shipping latest draft.`);
            break;
          }
          log.line(`🔧 Refining: ${truncate(ev.feedback, 120)}`);
          draft = await refineAgent(draft.markdown, ev.feedback);
        }

        log.line(``);
        log.line(`✅ Brochure ready.`);
        log.end();

        const brochure: BrochureData = {
          city,
          overview,
          facts,
          hotel,
          contact,
          images,
        };
        writer.write({ type: "data-brochure", data: brochure });
      } catch (err) {
        log.line(`⚠ Workflow failed: ${err instanceof Error ? err.message : String(err)}`);
        log.end();
      }
    },
    onFinish: threadId
      ? ({ responseMessage }) => persistAssistant(threadId, responseMessage)
      : undefined,
  });
  return createUIMessageStreamResponse({ stream });
}

// ── Mode 2: attractions follow-up ───────────────────────────────────────

function runAttractionsFollowUp(
  input: RunChatInput,
  prior: BrochureData,
): Response {
  const threadId = input.threadId;
  const stream = createUIMessageStream({
    originalMessages: threadId ? input.messages : undefined,
    execute: async ({ writer }) => {
      const log = makeLogger(writer);
      try {
        log.line(`🧠 Reusing brochure memory for ${prior.city} (no re-discovery).`);
        log.line(`   ↳ memory: ${prior.overview.country} · known for: ${prior.overview.knownFor.slice(0, 3).join(", ")}…`);

        log.line(`🎯 Selecting top 3 attractions (Sonnet)…`);
        const result = await attractionsAgent(prior);

        const withImg = result.attractions.filter((a) => a.image).length;
        log.line(`   ↳ ${result.attractions.map((a) => a.name).join(", ")}`);
        log.line(`🌐 Wikipedia images: ${withImg}/${result.attractions.length} resolved.`);
        log.line(``);
        log.line(`✅ Top 3 ready.`);
        log.end();

        writer.write({ type: "data-attractions", data: result });
      } catch (err) {
        log.line(`⚠ Attractions follow-up failed: ${err instanceof Error ? err.message : String(err)}`);
        log.end();
      }
    },
    onFinish: threadId
      ? ({ responseMessage }) => persistAssistant(threadId, responseMessage)
      : undefined,
  });
  return createUIMessageStreamResponse({ stream });
}

// ── Mode 3: costs follow-up ─────────────────────────────────────────────

function runCostsFollowUp(input: RunChatInput, prior: BrochureData): Response {
  const threadId = input.threadId;
  const stream = createUIMessageStream({
    originalMessages: threadId ? input.messages : undefined,
    execute: async ({ writer }) => {
      const log = makeLogger(writer);
      try {
        log.line(`🧠 Reusing brochure memory for ${prior.city} (no re-discovery).`);
        log.line(`   ↳ memory: currency ${prior.facts.currency} · hotel tier ${prior.hotel.priceRange}`);

        log.line(`💰 Estimating travel costs (Haiku, structured)…`);
        const result = await costsAgent(prior);
        log.line(`   ↳ daily ${result.currency}: budget ${result.daily.budget} · mid ${result.daily.midRange} · luxury ${result.daily.luxury}`);
        log.line(``);
        log.line(`✅ Cost estimate ready.`);
        log.end();

        writer.write({ type: "data-costs", data: result });
      } catch (err) {
        log.line(`⚠ Costs follow-up failed: ${err instanceof Error ? err.message : String(err)}`);
        log.end();
      }
    },
    onFinish: threadId
      ? ({ responseMessage }) => persistAssistant(threadId, responseMessage)
      : undefined,
  });
  return createUIMessageStreamResponse({ stream });
}

// ── helpers ─────────────────────────────────────────────────────────────

/** Lightweight wrapper around `writer.write` for status text. */
function makeLogger(writer: {
  write: (chunk: unknown) => void;
}): { line: (text: string) => void; end: () => void } {
  const id = generateId();
  writer.write({ type: "text-start", id });
  return {
    line: (text: string) =>
      writer.write({ type: "text-delta", id, delta: text + "\n" }),
    end: () => writer.write({ type: "text-end", id }),
  };
}

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  const parts = (last as { parts?: Array<{ type: string; text?: string }> })
    .parts;
  if (!parts) return "";
  return parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        p.type === "text" && typeof p.text === "string",
    )
    .map((p) => p.text)
    .join(" ")
    .trim();
}

/**
 * Walk the assistant message history backward and return the most
 * recent BrochureData payload found in a `data-brochure` part. This is
 * the "memory" lookup — what the follow-up agents read back instead of
 * running discovery again.
 */
function findLatestBrochureData(messages: UIMessage[]): BrochureData | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== "assistant") continue;
    const parts = (m as { parts?: Array<{ type?: string; data?: unknown }> }).parts;
    if (!parts) continue;
    for (const p of parts) {
      if (p?.type === "data-brochure" && p.data) {
        return p.data as BrochureData;
      }
    }
  }
  return null;
}

/**
 * Detect which follow-up sub-workflow this user message wants. Tightly
 * scoped: clicks from the suggestion buttons emit controlled phrasings,
 * and free-form prose like "What about Paris?" falls through to
 * full-discovery (which is the right behaviour for new cities).
 */
function detectFollowUp(text: string): FollowUp | null {
  const t = text.toLowerCase();
  // Plural-tolerant: \bcost\b would NOT match "costs" — the trailing
  // `s` is a word character. Use `s?` so we hit both forms.
  if (/\b(top\s+\d+|attractions?|sights?|things to do)\b/.test(t))
    return "attractions";
  if (/\b(costs?|expenses?|budget|prices?)\b/.test(t)) return "costs";
  return null;
}

function persistAssistant(threadId: string, msg: UIMessage): void {
  appendMessage({
    id: msg.id || generateId(),
    threadId,
    role: "assistant",
    parts: msg.parts ?? [],
    createdAt: Date.now(),
  });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

function describeCriteria(c: {
  completeness: number;
  tone: number;
  accuracy: number;
  length: number;
  format: number;
}): string {
  return `complete:${c.completeness} tone:${c.tone} accuracy:${c.accuracy} length:${c.length} format:${c.format}`;
}
