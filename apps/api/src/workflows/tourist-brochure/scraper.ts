/**
 * Image scraping for the tourist-brochure workflow.
 *
 * Source: Wikipedia's public REST API + Wikimedia Commons. No API key,
 * stable JSON shape, fast (typically <300ms), CORS-friendly so the
 * frontend can <img src="…"> the URLs directly.
 *
 * What we look up:
 *   - hero       → `summary/{City}`             page summary's originalimage
 *   - flag       → `summary/Flag_of_{Country}`  page summary's originalimage
 *   - citySymbol → `summary/Coat_of_arms_of_{City}` (or `Seal_of_{City}`)
 *
 * Each function returns `null` if the page is missing, is a
 * disambiguation, or has no image — so the rest of the workflow
 * degrades gracefully when a city's articles aren't standardised.
 */

const WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary";
const TIMEOUT_MS = 5000;
const USER_AGENT =
  "chat-demo-tourist-brochure/1.0 (https://github.com/frontendrasmus/starwars_demo)";

export interface ScrapedImage {
  url: string;
  caption: string;
  attribution: string;
  /** Wikipedia article URL — used for "via Wikipedia" linkback. */
  sourceUrl?: string;
}

interface WikiSummary {
  type?: string;
  title?: string;
  originalimage?: { source: string; width: number; height: number };
  thumbnail?: { source: string; width: number; height: number };
  content_urls?: { desktop?: { page?: string } };
}

async function fetchWikiSummary(title: string): Promise<WikiSummary | null> {
  const url = `${WIKI_API}/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as WikiSummary;
  } catch (err) {
    console.warn(`[scraper] wiki fetch failed for "${title}":`, err);
    return null;
  }
}

function pickImage(summary: WikiSummary | null): string | null {
  if (!summary) return null;
  if (summary.type === "disambiguation") return null;
  return summary.originalimage?.source ?? summary.thumbnail?.source ?? null;
}

function articleUrl(summary: WikiSummary): string | undefined {
  return summary.content_urls?.desktop?.page;
}

/**
 * Generic Wikipedia article image lookup. Used by the attractions
 * follow-up to grab an image for each named landmark / museum.
 */
export async function findArticleImage(
  title: string,
): Promise<ScrapedImage | null> {
  const summary = await fetchWikiSummary(title);
  const url = pickImage(summary);
  if (!url || !summary) return null;
  return {
    url,
    caption: summary.title ?? title,
    attribution: "via Wikipedia / Wikimedia Commons",
    sourceUrl: articleUrl(summary),
  };
}

/** Hero photo — what the city actually looks like. */
export async function findCityImage(city: string): Promise<ScrapedImage | null> {
  const summary = await fetchWikiSummary(city);
  const url = pickImage(summary);
  if (!url || !summary) return null;
  return {
    url,
    caption: `${summary.title ?? city}`,
    attribution: "via Wikipedia / Wikimedia Commons",
    sourceUrl: articleUrl(summary),
  };
}

/** Country flag — Wikipedia's "Flag of {Country}" page is reliable. */
export async function findCountryFlag(
  country: string,
): Promise<ScrapedImage | null> {
  const summary = await fetchWikiSummary(`Flag of ${country}`);
  const url = pickImage(summary);
  if (!url || !summary) return null;
  return {
    url,
    caption: `Flag of ${country}`,
    attribution: "via Wikipedia / Wikimedia Commons",
    sourceUrl: articleUrl(summary),
  };
}

/**
 * City symbol — coat of arms preferred, seal as fallback.
 * Many cities don't have either page; the function just returns null
 * in that case and the brochure renders without the badge.
 */
export async function findCitySymbol(city: string): Promise<ScrapedImage | null> {
  const candidates = [`Coat of arms of ${city}`, `Seal of ${city}`];
  for (const title of candidates) {
    const summary = await fetchWikiSummary(title);
    const url = pickImage(summary);
    if (url && summary) {
      return {
        url,
        caption: title,
        attribution: "via Wikipedia / Wikimedia Commons",
        sourceUrl: articleUrl(summary),
      };
    }
  }
  return null;
}
