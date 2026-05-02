/**
 * Draw Things provider — local Stable-Diffusion-compatible image API.
 *
 * Treated as a "model" in the picker even though it generates images,
 * not text. The chat service branches on provider === "drawthings" and
 * routes to generateImage() instead of streamText().
 *
 * Override the URL with DRAWTHINGS_URL in apps/api/.env.
 */

const DRAWTHINGS_URL = process.env.DRAWTHINGS_URL ?? "http://localhost:7860";
const PING_TIMEOUT_MS = 2000;
const GEN_TIMEOUT_MS = 120_000;

export type PingResult =
  | { ok: true }
  | { ok: false; error: string };

export interface ImageResult {
  images: string[]; // base64-encoded PNG, one per image
  info?: unknown;   // raw metadata blob from Draw Things
}

/** Reach out to the local Draw Things process; resolve quickly either way. */
export async function pingDrawThings(): Promise<PingResult> {
  try {
    const res = await fetch(`${DRAWTHINGS_URL}/sdapi/v1/options`, {
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `Draw Things responded HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Cannot reach Draw Things at ${DRAWTHINGS_URL} — ${err.message}`
          : `Cannot reach Draw Things at ${DRAWTHINGS_URL}`,
    };
  }
}

/** Run txt2img with sensible demo defaults. */
export async function generateImage(
  prompt: string,
  opts: { steps?: number; width?: number; height?: number } = {},
): Promise<ImageResult> {
  const res = await fetch(`${DRAWTHINGS_URL}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(GEN_TIMEOUT_MS),
    body: JSON.stringify({
      prompt,
      steps: opts.steps ?? 4,
      width: opts.width ?? 512,
      height: opts.height ?? 512,
    }),
  });
  if (!res.ok) {
    throw new Error(`Draw Things HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as ImageResult;
}
