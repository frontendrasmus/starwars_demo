/**
 * Thread + message store.
 *
 * Implementation: two in-memory Maps (threads and message arrays). Every
 * mutation calls scheduleSave() which debounces a write to disk via
 * persistence.ts — so reads stay instant and writes survive restarts.
 *
 * Swap for SQLite by replacing this file's body and keeping the same
 * exported function signatures. The routes layer doesn't care.
 */

import { randomUUID } from "node:crypto";
import type {
  ModelId,
  PersistedMessage,
  PromptId,
  ThreadDescriptor,
} from "@chat-demo/shared";
import { scheduleSave } from "./persistence.js";

const threads = new Map<string, ThreadDescriptor>();
const messagesByThread = new Map<string, PersistedMessage[]>();

const TITLE_MAX = 60;

/** Hydrate from disk on boot. Called once from persistence.loadFromDisk(). */
export function _hydrate(
  loadedThreads: ThreadDescriptor[],
  loadedMessages: PersistedMessage[],
) {
  threads.clear();
  messagesByThread.clear();
  for (const t of loadedThreads) threads.set(t.id, t);
  for (const m of loadedMessages) {
    const arr = messagesByThread.get(m.threadId) ?? [];
    arr.push(m);
    messagesByThread.set(m.threadId, arr);
  }
}

/** Snapshot used by persistence to write to disk. */
export function _snapshot() {
  return {
    threads: Array.from(threads.values()),
    messages: Array.from(messagesByThread.values()).flat(),
  };
}

export function createThread(opts: {
  modelId: ModelId;
  promptId: PromptId;
}): ThreadDescriptor {
  const now = Date.now();
  const thread: ThreadDescriptor = {
    id: randomUUID(),
    title: "",
    modelId: opts.modelId,
    promptId: opts.promptId,
    createdAt: now,
    updatedAt: now,
    archived: false,
    messageCount: 0,
  };
  threads.set(thread.id, thread);
  messagesByThread.set(thread.id, []);
  scheduleSave();
  return thread;
}

/** Sidebar listing — newest first, archived excluded by default. */
export function listThreads(opts: { includeArchived?: boolean } = {}): ThreadDescriptor[] {
  const out: ThreadDescriptor[] = [];
  for (const t of threads.values()) {
    if (!opts.includeArchived && t.archived) continue;
    out.push(t);
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

export function getThread(id: string): ThreadDescriptor | undefined {
  return threads.get(id);
}

export function getMessages(threadId: string): PersistedMessage[] {
  return messagesByThread.get(threadId) ?? [];
}

/**
 * Upsert a message by id. Used by the chat route to record both the user
 * turn (before the stream) and the assistant turn (in onFinish). Upsert
 * semantics make the call idempotent — re-sending the same message id
 * just replaces it.
 */
export function appendMessage(msg: PersistedMessage): void {
  const thread = threads.get(msg.threadId);
  if (!thread) return;

  const arr = messagesByThread.get(msg.threadId) ?? [];
  const existingIdx = arr.findIndex((m) => m.id === msg.id);
  if (existingIdx >= 0) arr[existingIdx] = msg;
  else arr.push(msg);
  messagesByThread.set(msg.threadId, arr);

  // Auto-derive title from the first user message
  if (!thread.title && msg.role === "user") {
    thread.title = deriveTitle(msg.parts);
  }
  thread.updatedAt = Date.now();
  thread.messageCount = arr.length;
  scheduleSave();
}

export function updateThread(
  id: string,
  patch: Partial<Pick<ThreadDescriptor, "title" | "archived">>,
): ThreadDescriptor | undefined {
  const t = threads.get(id);
  if (!t) return undefined;
  if (patch.title !== undefined) t.title = patch.title.slice(0, TITLE_MAX);
  if (patch.archived !== undefined) t.archived = patch.archived;
  t.updatedAt = Date.now();
  scheduleSave();
  return t;
}

export function deleteThread(id: string): boolean {
  const had = threads.delete(id);
  messagesByThread.delete(id);
  if (had) scheduleSave();
  return had;
}

/** Pull a sensible title out of the first user message's parts. */
function deriveTitle(parts: unknown[]): string {
  const text = parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        typeof p === "object" &&
        p !== null &&
        (p as { type?: unknown }).type === "text" &&
        typeof (p as { text?: unknown }).text === "string",
    )
    .map((p) => p.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "Untitled chat";
  return text.length > TITLE_MAX
    ? text.slice(0, TITLE_MAX).trimEnd() + "…"
    : text;
}
