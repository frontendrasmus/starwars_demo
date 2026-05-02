// Static top-level import so Node.js picks the `node` export condition
// (→ transformers.node.mjs) rather than the `default` web bundle that a
// dynamic `await import()` can accidentally resolve to under tsx watch.
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

/**
 * Local sentence embedder using transformers.js (ONNX runtime).
 *
 * Why local? Document content never leaves this process for the purpose
 * of indexing or searching. Only the snippets the model actually decides
 * to use end up in the prompt sent to Anthropic/OpenAI. This is the
 * security property worth pointing at on stage.
 *
 * Model: Xenova/all-MiniLM-L6-v2. 384-dim vectors, ~25MB on disk, runs
 * comfortably on CPU. The model downloads on first call (cached after
 * that) — expect a few seconds of cold start the very first time the
 * server runs.
 *
 * Singleton pattern: building the pipeline is expensive (model load +
 * tokenizer init), so we want exactly one per process. The promise is
 * cached so concurrent first-callers all wait on the same load.
 */

const MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIM = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      MODEL,
    ) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

/**
 * Embed an array of texts, returning unit-length 384-dim vectors.
 * Because vectors are normalised, cosine similarity is just a dot product.
 */
export async function embed(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const tensor = await extractor(texts, { pooling: "mean", normalize: true });
  // tensor.data is a flat Float32Array of length texts.length * EMBEDDING_DIM
  const flat = tensor.data as Float32Array;
  const result: Float32Array[] = [];
  for (let i = 0; i < texts.length; i++) {
    result.push(flat.slice(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM));
  }
  return result;
}

/** Dot product on equal-length vectors. */
export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}
