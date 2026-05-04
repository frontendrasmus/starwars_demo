import { useCallback, useEffect, useState } from "react";
import type {
  ModelId,
  PersistedMessage,
  PromptId,
  ThreadDescriptor,
} from "@chat-demo/shared";

/**
 * Manages the sidebar thread list and provides imperative actions
 * (create, delete, rename, hydrate).
 *
 * State lives at App level — not inside any individual Chat instance —
 * so switching threads doesn't lose the list, and creating a new thread
 * from inside Chat propagates back up via the returned helpers.
 */

interface UseThreadListResult {
  threads: ThreadDescriptor[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createThread: (opts: { modelId: ModelId; promptId: PromptId }) => Promise<ThreadDescriptor>;
  deleteThread: (id: string) => Promise<void>;
  loadMessages: (id: string) => Promise<PersistedMessage[]>;
}

export function useThreadList(apiUrl: string): UseThreadListResult {
  const [threads, setThreads] = useState<ThreadDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/threads`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { threads: ThreadDescriptor[] };
      setThreads(data.threads);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createThread = useCallback<UseThreadListResult["createThread"]>(
    async (opts) => {
      const res = await fetch(`${apiUrl}/api/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      if (!res.ok) throw new Error(`Could not create thread: HTTP ${res.status}`);
      const created = (await res.json()) as ThreadDescriptor;
      // Optimistic prepend so the sidebar reflects it immediately.
      setThreads((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
      return created;
    },
    [apiUrl],
  );

  const deleteThread = useCallback<UseThreadListResult["deleteThread"]>(
    async (id) => {
      const res = await fetch(`${apiUrl}/api/threads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Could not delete thread: HTTP ${res.status}`);
      setThreads((prev) => prev.filter((t) => t.id !== id));
    },
    [apiUrl],
  );

  const loadMessages = useCallback<UseThreadListResult["loadMessages"]>(
    async (id) => {
      const res = await fetch(`${apiUrl}/api/threads/${id}`);
      if (!res.ok) throw new Error(`Could not load thread: HTTP ${res.status}`);
      const data = (await res.json()) as { messages: PersistedMessage[] };
      return data.messages;
    },
    [apiUrl],
  );

  return { threads, loading, error, refresh, createThread, deleteThread, loadMessages };
}
