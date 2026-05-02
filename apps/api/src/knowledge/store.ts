import { embed, dot } from "./embedder.js";


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


export function clearStore(): void {
  chunks.length = 0;
}


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
