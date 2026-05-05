/**
 * The subagents. Each is a single LLM call (or in imageAgent's case,
 * one LLM call + a fan-out to Drawthings). Models are picked per agent:
 * cheap structured tasks → local Gemma 4 with a Claude fallback,
 * quality writing → Sonnet, judgment → Haiku.
 */

import { generateObject, type LanguageModel } from "ai";
import { anthropicModel } from "../../providers/anthropic.js";
import { ollamaModel } from "../../providers/ollama.js";
import {
  contactSchema,
  draftSchema,
  evalSchema,
  factsSchema,
  hotelSchema,
  overviewSchema,
  type BrochureImageSet,
  type Contact,
  type Draft,
  type EvalResult,
  type Facts,
  type Hotel,
  type Overview,
} from "./schemas.js";
import { SYSTEM } from "./prompts.js";
import {
  findCityImage,
  findCitySymbol,
  findCountryFlag,
} from "./scraper.js";

const sonnet: LanguageModel = anthropicModel("claude-sonnet-4-6");
const haiku: LanguageModel = anthropicModel("claude-haiku-4-5");
const gemma: LanguageModel = ollamaModel("gemma4:latest");

/**
 * Try the primary model first; on any error fall back to a backup.
 * Used to make local-Ollama agents robust if Ollama is down.
 */
async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  label: string,
): Promise<T> {
  try {
    return await primary();
  } catch (err) {
    console.warn(`[brochure] ${label} primary failed, falling back:`, err);
    return await fallback();
  }
}

export async function overviewAgent(city: string): Promise<Overview> {
  const { object } = await generateObject({
    model: haiku,
    schema: overviewSchema,
    system: SYSTEM.overview,
    prompt: `Write an overview of ${city}.`,
  });
  return object;
}

export async function factsAgent(city: string): Promise<Facts> {
  return withFallback(
    async () => {
      const { object } = await generateObject({
        model: gemma,
        schema: factsSchema,
        system: SYSTEM.facts,
        prompt: `Quick facts about ${city}.`,
      });
      return object;
    },
    async () => {
      const { object } = await generateObject({
        model: haiku,
        schema: factsSchema,
        system: SYSTEM.facts,
        prompt: `Quick facts about ${city}.`,
      });
      return object;
    },
    "factsAgent",
  );
}

export async function hotelAgent(city: string): Promise<Hotel> {
  const { object } = await generateObject({
    model: haiku,
    schema: hotelSchema,
    system: SYSTEM.hotel,
    prompt: `Recommend one distinctive hotel in ${city}.`,
  });
  return object;
}

export async function contactAgent(city: string): Promise<Contact> {
  return withFallback(
    async () => {
      const { object } = await generateObject({
        model: gemma,
        schema: contactSchema,
        system: SYSTEM.contact,
        prompt: `Tourist office contact details for ${city}.`,
      });
      return object;
    },
    async () => {
      const { object } = await generateObject({
        model: haiku,
        schema: contactSchema,
        system: SYSTEM.contact,
        prompt: `Tourist office contact details for ${city}.`,
      });
      return object;
    },
    "contactAgent",
  );
}

/**
 * Image-finder subagent. Pure HTTP — no LLM call. Three Wikipedia
 * lookups in parallel:
 *
 *   - hero       : photo of the city itself
 *   - flag       : country flag
 *   - citySymbol : coat of arms (preferred) or seal (fallback)
 *
 * Each is independent and individually nullable, so a city with a
 * standard photo but no coat-of-arms page still produces a hero +
 * flag and degrades gracefully on the third slot.
 *
 * Returns within ~300-1500ms typically (vs Drawthings's 30-60s),
 * which is the whole point of switching.
 */
export async function imageAgent(
  city: string,
  country: string,
): Promise<BrochureImageSet> {
  const [hero, flag, citySymbol] = await Promise.all([
    findCityImage(city),
    findCountryFlag(country),
    findCitySymbol(city),
  ]);
  return {
    ...(hero ? { hero } : {}),
    ...(flag ? { flag } : {}),
    ...(citySymbol ? { citySymbol } : {}),
  };
}

interface DraftInput {
  city: string;
  overview: Overview;
  facts: Facts;
  hotel: Hotel;
  contact: Contact;
}

export async function draftAgent(input: DraftInput): Promise<Draft> {
  const { object } = await generateObject({
    model: sonnet,
    schema: draftSchema,
    system: SYSTEM.draft,
    prompt: `City: ${input.city}
Country: ${input.overview.country}
Overview: ${input.overview.summary}
Known for: ${input.overview.knownFor.join(", ")}

Facts:
${JSON.stringify(input.facts, null, 2)}

Recommended hotel:
${JSON.stringify(input.hotel, null, 2)}

Tourist office:
${JSON.stringify(input.contact, null, 2)}

Compose the brochure now.`,
  });
  return object;
}

export async function evalAgent(draftMarkdown: string): Promise<EvalResult> {
  const { object } = await generateObject({
    model: haiku,
    schema: evalSchema,
    system: SYSTEM.evaluate,
    prompt: `Evaluate the following brochure draft:\n\n---\n${draftMarkdown}\n---`,
  });
  return object;
}

export async function refineAgent(
  previousMarkdown: string,
  feedback: string,
): Promise<Draft> {
  const { object } = await generateObject({
    model: sonnet,
    schema: draftSchema,
    system: SYSTEM.refine,
    prompt: `Reviewer's feedback:
${feedback}

Original draft (revise this):
---
${previousMarkdown}
---

Return the revised brochure.`,
  });
  return object;
}
