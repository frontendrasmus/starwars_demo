/**
 * Structured-output schemas for every subagent. Each agent returns a
 * typed object via `generateObject`, so the workflow is a typed
 * data-flow graph rather than a string-passing pipeline.
 */

import { z } from "zod";

export const overviewSchema = z.object({
  summary: z
    .string()
    .describe("2-3 sentences capturing the city's character"),
  country: z.string(),
  knownFor: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Iconic things this city is known for"),
});

export const factsSchema = z.object({
  population: z.string().describe("e.g. '545,000' or 'about 2.8 million'"),
  area: z.string().describe("with units, e.g. '100 km²'"),
  climate: z.string().describe("brief — e.g. 'Mediterranean, mild winters'"),
  currency: z.string(),
  language: z.string(),
  bestSeason: z.string().describe("e.g. 'May to October'"),
  funFact: z.string().describe("One unexpected, charming, true-feeling fact"),
});

export const hotelSchema = z.object({
  name: z.string(),
  area: z.string().describe("Neighbourhood or district"),
  priceRange: z.enum(["$", "$$", "$$$", "$$$$"]),
  why: z.string().describe("One short paragraph rationale"),
});

export const contactSchema = z.object({
  officeName: z.string(),
  address: z.string(),
  phone: z.string(),
  website: z.string().describe("Tourist office website (URL)"),
});

export const draftSchema = z.object({
  markdown: z.string().describe("Full brochure text as markdown"),
});

export const evalSchema = z.object({
  passes: z.boolean(),
  score: z.number().min(0).max(10),
  criteria: z.object({
    completeness: z.number().min(0).max(2),
    tone: z.number().min(0).max(2),
    accuracy: z.number().min(0).max(2),
    length: z.number().min(0).max(2),
    format: z.number().min(0).max(2),
  }),
  feedback: z
    .string()
    .describe("Specific, actionable feedback for the refine step"),
});

/**
 * Follow-up agent: top 3 attractions. Reuses prior BrochureData via the
 * "memory" pattern (prior data part read from thread history, fed back
 * into this agent as context).
 */
export const attractionsSchema = z.object({
  attractions: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "Specific landmark / district / venue. Match Wikipedia's article title style so we can scrape an image.",
          ),
        description: z.string().describe("2-3 sentences"),
        category: z.string().describe("e.g. 'Landmark', 'Museum', 'District'"),
        bestTime: z.string().describe("Best time of day or season to visit"),
        estimatedDuration: z
          .string()
          .describe("e.g. '2 hours', 'half day'"),
      }),
    )
    .length(3),
});

/** Follow-up agent: rough travel cost estimate. */
export const costsSchema = z.object({
  daily: z.object({
    budget: z
      .number()
      .describe("Budget traveller daily total in the city's currency"),
    midRange: z.number().describe("Mid-range traveller daily total"),
    luxury: z.number().describe("Luxury traveller daily total"),
  }),
  breakdown: z.object({
    accommodation: z.string().describe("e.g. '€100-200/night for 3-4★'"),
    food: z.string().describe("e.g. '€30-60/day mid-range'"),
    transport: z.string().describe("e.g. '€10-20/day public, €40-80 taxi'"),
    attractions: z.string().describe("Typical entrance fees / tour costs"),
    flightFromMajorEU: z
      .string()
      .optional()
      .describe("Round-trip from a major European hub (rough)"),
  }),
  notes: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("Cost-saving tips and the assumptions behind the estimate"),
});

export type Overview = z.infer<typeof overviewSchema>;
export type Facts = z.infer<typeof factsSchema>;
export type Hotel = z.infer<typeof hotelSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type EvalResult = z.infer<typeof evalSchema>;

/** Re-export the scraped-image type so agents.ts can import from one place. */
export type { ScrapedImage } from "./scraper.js";

/** Composite image set produced by imageAgent — all fields optional. */
export interface BrochureImageSet {
  hero?: import("./scraper.js").ScrapedImage;
  flag?: import("./scraper.js").ScrapedImage;
  citySymbol?: import("./scraper.js").ScrapedImage;
}
