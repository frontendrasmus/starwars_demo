/**
 * Disk persistence for the thread store.
 *
 * Strategy: write-through with a 500ms debounce. Every mutation in
 * store.ts schedules a save; if many mutations happen in quick succession
 * (e.g. an assistant response with several parts) we coalesce them into
 * a single fs.writeFile.
 *
 * On boot, loadFromDisk() reads the snapshot and re-hydrates the store.
 * Missing or corrupt file → start empty.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { PersistedMessage, ThreadDescriptor } from "@chat-demo/shared";
import { _hydrate, _snapshot } from "./store.js";

const FILE_PATH = process.env.THREADS_FILE
  ?? new URL("../../data/threads.json", import.meta.url).pathname;
const DEBOUNCE_MS = 500;

let saveTimer: NodeJS.Timeout | null = null;
let saveInFlight: Promise<void> | null = null;

interface Snapshot {
  threads: ThreadDescriptor[];
  messages: PersistedMessage[];
}

export async function loadFromDisk(): Promise<void> {
  try {
    const raw = await readFile(FILE_PATH, "utf-8");
    const data = JSON.parse(raw) as Snapshot;
    _hydrate(data.threads ?? [], data.messages ?? []);
    console.log(
      `📂 threads: loaded ${data.threads?.length ?? 0} threads, ${data.messages?.length ?? 0} messages`,
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("📂 threads: no snapshot found, starting empty");
    } else {
      console.warn("📂 threads: failed to load snapshot, starting empty:", err);
    }
  }
}

export function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveInFlight = doSave().catch((err) =>
      console.error("📂 threads: save failed:", err),
    );
  }, DEBOUNCE_MS);
}

/** Force-flush — useful in tests or graceful shutdown. */
export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    await doSave();
  }
  if (saveInFlight) await saveInFlight;
}

async function doSave(): Promise<void> {
  const data = _snapshot();
  await mkdir(dirname(FILE_PATH), { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}
