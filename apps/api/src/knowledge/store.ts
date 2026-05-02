import { embed, dot } from "./embedder.js";

/**
 * In-memory vector store.
 *
 * Each entry is a chunk of source text, its embedding, and its source
 * label. When the server restarts the store is empty — that's fine for
 * a demo, and arguably a feature: every fresh `pnpm dev` starts with
 * a clean knowledge base. For production you'd swap this for sqlite-vec,
 * pgvector, or similar — the store interface is small enough that the
 * swap is one file.
 */

export interface KnowledgeChunk {
  id: string;
  source: string;
  text: string;
  embedding: Float32Array;
}

export interface KnowledgeSummary {
  source: string;
  chunkCount: number;
  totalChars: number;
}

export interface SearchHit {
  source: string;
  text: string;
  score: number;
}

const chunks: KnowledgeChunk[] = [];
let nextId = 1;

/**
 * Naïve chunker: split on blank lines, then group paragraphs until each
 * group is between MIN_CHARS and MAX_CHARS. Production RAG uses smarter
 * splitters (recursive character, semantic, sliding window with overlap),
 * but this is enough to get sensible retrieval on prose and small docs.
 */
const MIN_CHARS = 200;
const MAX_CHARS = 800;

function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: string[] = [];
  let buffer = "";
  for (const para of paragraphs) {
    if (buffer.length + para.length + 2 <= MAX_CHARS) {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    } else {
      if (buffer) out.push(buffer);
      // If a single paragraph is huge, split it further.
      if (para.length > MAX_CHARS) {
        for (let i = 0; i < para.length; i += MAX_CHARS) {
          out.push(para.slice(i, i + MAX_CHARS));
        }
        buffer = "";
      } else {
        buffer = para;
      }
    }
    if (buffer.length >= MIN_CHARS) {
      out.push(buffer);
      buffer = "";
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

/**
 * Add a document. Chunks the text, embeds each chunk in one batch call
 * (cheaper than embedding chunks one at a time), and appends to the store.
 */
export async function addDocument(
  source: string,
  text: string,
): Promise<{ source: string; chunksAdded: number }> {
  const pieces = chunkText(text);
  if (pieces.length === 0) return { source, chunksAdded: 0 };

  const embeddings = await embed(pieces);
  for (let i = 0; i < pieces.length; i++) {
    chunks.push({
      id: `c${nextId++}`,
      source,
      text: pieces[i]!,
      embedding: embeddings[i]!,
    });
  }
  return { source, chunksAdded: pieces.length };
}

/** A grouped view of what's in the store, used by GET /api/knowledge. */
export function listSources(): KnowledgeSummary[] {
  const map = new Map<string, KnowledgeSummary>();
  for (const chunk of chunks) {
    const existing = map.get(chunk.source);
    if (existing) {
      existing.chunkCount += 1;
      existing.totalChars += chunk.text.length;
    } else {
      map.set(chunk.source, {
        source: chunk.source,
        chunkCount: 1,
        totalChars: chunk.text.length,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.source.localeCompare(b.source),
  );
}

/** Wipe the store. Used by the UI's "clear" button. */
export function clearStore(): void {
  chunks.length = 0;
}

/**
 * Top-K cosine similarity search. Vectors from embed() are already
 * normalised so cosine = dot product. Linear scan is fine for demo
 * sizes; swap for an ANN index when you have >100k chunks.
 */
export async function search(query: string, k: number = 4): Promise<SearchHit[]> {
  if (chunks.length === 0) return [];
  const [queryEmbedding] = await embed([query]);
  if (!queryEmbedding) return [];

  const scored = chunks.map((chunk) => ({
    source: chunk.source,
    text: chunk.text,
    score: dot(queryEmbedding, chunk.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
