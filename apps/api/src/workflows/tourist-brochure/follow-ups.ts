/**
 * Follow-up subagents for the tourist-brochure workflow.
 *
 * The "memory" pattern (https://ai-sdk.dev/docs/agents/memory):
 * the prior brochure's structured data — country, knownFor, currency,
 * hotel price tier, etc. — is read out of the thread's persisted
 * messages and threaded into these agents as input. No re-discovery.
 *
 * Each follow-up returns a typed payload that gets emitted as a
 * `data-attractions` or `data-costs` part for the frontend cards.
 */

import { generateObject } from "ai";
import type { AttractionsData, BrochureData, CostsData } from "@chat-demo/shared";
import { anthropicModel } from "../../providers/anthropic.js";
import { attractionsSchema, costsSchema } from "./schemas.js";
import { findArticleImage } from "./scraper.js";

const sonnet = anthropicModel("claude-sonnet-4-6");
const haiku = anthropicModel("claude-haiku-4-5");

const SYSTEM_ATTRACTIONS = `You are a travel curator. Given a city's
overview and what it's known for, name the THREE most iconic must-visit
attractions. Be specific — landmarks, districts, museums, sites — not
generic ("good food", "beaches"). Each name should be specific enough
to look up on Wikipedia.

For each, provide a short description (2-3 sentences), a category
(Landmark / Museum / District / Park / Religious / Historic), best time
to visit, and rough duration. Avoid AI clichés. Output JSON.`;

const SYSTEM_COSTS = `You are a travel cost analyst. Estimate typical
daily travel costs for the named city, broken down into budget /
mid-range / luxury daily totals (numbers in the local currency).

Provide ranges for accommodation, food, public transport, and
attractions in plain prose ("€80-150/night"). Optionally provide a
round-trip flight estimate from a major European hub.

End with 3-5 cost-saving tips that double as the assumptions behind
your numbers. Be honest — say "rough estimate" rather than fabricating
precision.`;

/**
 * Top-3 attractions follow-up. Memory in: BrochureData. Memory used:
 * city, country, knownFor, summary. LLM picks 3, scraper fetches
 * Wikipedia images in parallel.
 */
export async function attractionsAgent(
  prior: BrochureData,
): Promise<AttractionsData> {
  const { object } = await generateObject({
    model: sonnet,
    schema: attractionsSchema,
    system: SYSTEM_ATTRACTIONS,
    prompt: `City: ${prior.city}
Country: ${prior.overview.country}
Overview: ${prior.overview.summary}
Already known for: ${prior.overview.knownFor.join(", ")}

Pick the three iconic must-see attractions. Be specific.`,
  });

  // Scrape an image for each attraction in parallel — small payload,
  // returns within ~1s usually.
  const withImages = await Promise.all(
    object.attractions.map(async (a) => {
      const image = await findArticleImage(a.name);
      return { ...a, ...(image ? { image } : {}) };
    }),
  );

  return {
    city: prior.city,
    country: prior.overview.country,
    attractions: withImages,
  };
}

/**
 * Travel-cost follow-up. Memory in: BrochureData. Memory used:
 * city, country, currency, hotel.priceRange (anchors the luxury tier).
 */
export async function costsAgent(prior: BrochureData): Promise<CostsData> {
  const { object } = await generateObject({
    model: haiku,
    schema: costsSchema,
    system: SYSTEM_COSTS,
    prompt: `City: ${prior.city}
Country: ${prior.overview.country}
Local currency: ${prior.facts.currency}
Reference hotel: ${prior.hotel.name} (${prior.hotel.area}, ${prior.hotel.priceRange})

Estimate typical daily travel costs in ${prior.facts.currency}.`,
  });

  return {
    city: prior.city,
    country: prior.overview.country,
    currency: prior.facts.currency,
    daily: object.daily,
    breakdown: object.breakdown,
    notes: object.notes,
  };
}
