/**
 * Wire types shared between the API and the web app. Keep this file
 * intentionally thin — only types that cross the HTTP boundary live here.
 */

export type ModelId = `${string}/${string}`;

export interface ModelDescriptor {
  id: ModelId;
  label: string;
  provider: "anthropic" | "openai" | "drawthings" | "ollama";
}

export type PromptId = string;

export interface PromptDescriptor {
  id: PromptId;
  label: string;
  description: string;
  /** Tool names this prompt is allowed to invoke; double duty as a UI hint. */
  tools: string[];
  /**
   * If set, this prompt is handled by a server-side workflow
   * (multiple LLM calls + structured outputs + evals) rather than a
   * single streamText invocation. The chat service branches on this.
   */
  workflow?: string;
  /**
   * Optional intro message shown by the UI in the chat thread when
   * the user selects this prompt and the thread is empty. Purely
   * presentational — never sent to the LLM, never persisted as a
   * message. Auto-hides once a real message arrives.
   */
  welcomeMessage?: string;
}

/**
 * Lightweight thread metadata returned by GET /api/threads.
 * The full message history is fetched separately via GET /api/threads/:id
 * so the sidebar can stay snappy even with hundreds of threads.
 */
export interface ThreadDescriptor {
  id: string;
  /** Substring of the first user message; auto-set on first append. */
  title: string;
  /** The model the thread was started with — frozen for thread lifetime. */
  modelId: ModelId;
  promptId: PromptId;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  /** Cheap counter used by the sidebar to hide empty threads. */
  messageCount: number;
}

/**
 * One persisted message. We store the raw assistant-ui parts array (not
 * just text) so reloading a thread rehydrates tool-call cards, generated
 * images, etc. with full fidelity.
 */
/**
 * Payload for the `data-brochure` UI message part. Emitted by the
 * tourist-brochure workflow and rendered by the BrochureCard widget
 * in the web app. Persisted as-is on the assistant message, so a
 * thread reload re-renders the same card with full fidelity.
 */
export interface BrochureData {
  city: string;
  overview: {
    summary: string;
    country: string;
    knownFor: string[];
  };
  facts: {
    population: string;
    area: string;
    climate: string;
    currency: string;
    language: string;
    bestSeason: string;
    funFact: string;
  };
  hotel: {
    name: string;
    area: string;
    priceRange: "$" | "$$" | "$$$" | "$$$$";
    why: string;
  };
  contact: {
    officeName: string;
    address: string;
    phone: string;
    website: string;
  };
  /**
   * Images scraped from Wikipedia / Wikimedia Commons. Each field is
   * optional so the renderer degrades gracefully when a particular
   * article doesn't exist for the city / country.
   */
  images: {
    hero?: ScrapedImageRef;
    flag?: ScrapedImageRef;
    citySymbol?: ScrapedImageRef;
  };
}

export interface ScrapedImageRef {
  /** Remote URL (Wikipedia / Wikimedia Commons). Loaded directly via <img>. */
  url: string;
  caption: string;
  attribution: string;
  /** Wikipedia article URL — for "via Wikipedia" linkback. */
  sourceUrl?: string;
}

/**
 * Payload for the `data-attractions` UI message part. Produced by a
 * follow-up subagent that re-uses BrochureData as memory and asks
 * "what are the top 3 attractions" without re-running discovery.
 */
export interface AttractionsData {
  city: string;
  country: string;
  attractions: Array<{
    name: string;
    description: string;
    category: string;
    bestTime: string;
    estimatedDuration: string;
    image?: ScrapedImageRef;
  }>;
}

/**
 * Payload for the `data-costs` UI message part. Produced by a follow-up
 * subagent that uses BrochureData (currency, hotel price tier, etc.)
 * as memory to ground a cost estimate.
 */
export interface CostsData {
  city: string;
  country: string;
  currency: string;
  daily: {
    budget: number;
    midRange: number;
    luxury: number;
  };
  breakdown: {
    accommodation: string;
    food: string;
    transport: string;
    attractions: string;
    flightFromMajorEU?: string;
  };
  /** 3-5 cost-saving tips + the assumptions the estimate was based on. */
  notes: string[];
}

export interface PersistedMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  /** Opaque to the backend — pass through to the frontend on load. */
  parts: unknown[];
  createdAt: number;
}
