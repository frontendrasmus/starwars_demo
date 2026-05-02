

import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";


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


export async function embed(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const tensor = await extractor(texts, { pooling: "mean", normalize: true });

  const flat = tensor.data as Float32Array;
  const result: Float32Array[] = [];
  for (let i = 0; i < texts.length; i++) {
    result.push(flat.slice(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM));
  }
  return result;
}


export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}
