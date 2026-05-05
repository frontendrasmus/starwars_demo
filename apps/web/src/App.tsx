import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ModelDescriptor,
  ModelId,
  PersistedMessage,
  PromptDescriptor,
  PromptId,
  ThreadDescriptor,
} from "@chat-demo/shared";
import { Chat, type DrawThingsSettings } from "./components/Chat.js";
import { DrawThingsSettingsBar } from "./components/DrawThingsSettingsBar.js";
import { KnowledgePanel } from "./components/KnowledgePanel.js";
import { ThreadSidebar } from "./components/ThreadSidebar.js";
import { useThreadList } from "./hooks/useThreadList.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export function App() {
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [prompts, setPrompts] = useState<PromptDescriptor[]>([]);
  const [modelId, setModelId] = useState<ModelId | null>(null);
  const [promptId, setPromptId] = useState<PromptId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelHealthError, setModelHealthError] = useState<string | null>(null);
  const [drawSettings, setDrawSettings] = useState<DrawThingsSettings>({
    steps: 4,
    width: 512,
    height: 512,
  });

  // Sidebar / thread state.
  const threadList = useThreadList(API_URL);
  // The currently-active thread id. Null = "fresh chat, will mint on first send".
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  // Re-key for <Chat>. Decoupled from activeThreadId so that auto-creating
  // a thread mid-conversation does NOT remount Chat.
  const [chatKey, setChatKey] = useState<string>(() => freshKey());
  // Initial messages to hydrate Chat with when it (re)mounts.
  const [initialMessages, setInitialMessages] = useState<PersistedMessage[]>([]);

  // Load models + prompts on mount.
  useEffect(() => {
    const fetchJson = <T,>(path: string) =>
      fetch(`${API_URL}${path}`).then((r) => {
        if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
        return r.json() as Promise<T>;
      });

    Promise.all([
      fetchJson<{ models: ModelDescriptor[] }>("/api/models"),
      fetchJson<{ prompts: PromptDescriptor[] }>("/api/prompts"),
    ])
      .then(([{ models }, { prompts }]) => {
        setModels(models);
        setPrompts(prompts);
        if (models[0]) setModelId(models[0].id);
        if (prompts[0]) setPromptId(prompts[0].id);
      })
      .catch((err) =>
        setError(`Could not reach API at ${API_URL}: ${err.message}`),
      );
  }, []);

  // Drawthings is fundamentally not a chat model — pair it with the
  // dedicated "image" prompt so the workflow / system-prompt selected
  // for a text model (e.g. brochure, SQL, coach) doesn't leak into the
  // image-gen path. We remember the previous selection in a ref so it's
  // restored when the user switches back to a text model.
  const previousTextPromptId = useRef<PromptId | null>(null);
  useEffect(() => {
    if (!modelId || !promptId) return;
    const isImageModel = modelId.startsWith("drawthings/");

    if (isImageModel && promptId !== "image") {
      previousTextPromptId.current = promptId;
      setPromptId("image");
    } else if (!isImageModel && promptId === "image") {
      // Coming back to a text model — restore whatever the user had
      // before, or fall back to "default".
      setPromptId(previousTextPromptId.current ?? "default");
      previousTextPromptId.current = null;
    }
  }, [modelId, promptId]);

  // Liveness probe for local-process providers (drawthings, ollama).
  // Cloud providers (anthropic, openai) are assumed reachable.
  useEffect(() => {
    if (!modelId) return;
    const provider = modelId.split("/")[0];
    const localProviders: Record<string, string> = {
      drawthings: "drawthings",
      ollama: "ollama",
    };
    const healthPath = localProviders[provider];
    if (!healthPath) {
      setModelHealthError(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/api/health/${healthPath}`)
      .then((r) => r.json() as Promise<{ ok: boolean; error?: string }>)
      .then((data) => {
        if (cancelled) return;
        setModelHealthError(
          data.ok ? null : data.error ?? `${provider} is unreachable.`,
        );
      })
      .catch((err) => {
        if (!cancelled) setModelHealthError(`Health check failed: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  // ── Sidebar actions ─────────────────────────────────────────────────────

  const startNewChat = useCallback(() => {
    setActiveThreadId(null);
    setInitialMessages([]);
    setChatKey(freshKey());
  }, []);

  const openThread = useCallback(
    async (id: string) => {
      const thread = threadList.threads.find((t) => t.id === id);
      if (!thread) return;
      try {
        const messages = await threadList.loadMessages(id);
        setActiveThreadId(id);
        setInitialMessages(messages);
        // Per-thread frozen model/prompt — restore them in the dropdowns.
        setModelId(thread.modelId);
        setPromptId(thread.promptId);
        setChatKey(id);
      } catch (err) {
        console.error("Failed to load thread", err);
      }
    },
    [threadList],
  );

  const removeThread = useCallback(
    async (id: string) => {
      try {
        await threadList.deleteThread(id);
        if (activeThreadId === id) startNewChat();
      } catch (err) {
        console.error("Failed to delete thread", err);
      }
    },
    [threadList, activeThreadId, startNewChat],
  );

  // Chat tells us when it auto-created a thread on first send.
  const onThreadCreated = useCallback(
    (thread: ThreadDescriptor) => {
      setActiveThreadId(thread.id);
      // Don't change chatKey — we want the in-flight conversation to stay live.
      // Refresh the sidebar so the new thread shows up (titled after the next save).
      void threadList.refresh();
    },
    [threadList],
  );

  // Periodically refresh the sidebar so titles + counts update after saves
  // (the backend persists asynchronously). 1.5s is comfortable for a demo.
  useEffect(() => {
    const t = setInterval(() => void threadList.refresh(), 1500);
    return () => clearInterval(t);
  }, [threadList]);

  const ready = modelId && promptId;
  const isDrawThings = modelId?.startsWith("drawthings/") ?? false;
  const activePrompt = useMemo(
    () => prompts.find((p) => p.id === promptId),
    [prompts, promptId],
  );
  const activePromptTools = activePrompt?.tools ?? [];
  // Drawthings only sees the "image" prompt; text models hide it.
  const visiblePrompts = useMemo(
    () =>
      prompts.filter((p) =>
        isDrawThings ? p.id === "image" : p.id !== "image",
      ),
    [prompts, isDrawThings],
  );

  return (
    <>
      <header className="header">
        <h1>Chat demo <em>v4</em></h1>
        <span className="header-label">Assistant:</span>
        <select
          value={promptId ?? ""}
          onChange={(e) => setPromptId(e.target.value)}
          disabled={visiblePrompts.length <= 1}
          aria-label="Select prompt"
          title={activePrompt?.description}
        >
          {visiblePrompts.map((p) => (
            <option key={p.id} value={p.id} title={p.description}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="header-label">Model:</span>
        <select
          value={modelId ?? ""}
          onChange={(e) => setModelId(e.target.value as ModelId)}
          disabled={models.length === 0}
          aria-label="Select model"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="tools-hint">
          tools:{" "}
          {activePromptTools.length === 0
            ? "(none)"
            : activePromptTools.join(", ")}
        </span>
        <KnowledgePanel apiUrl={API_URL} />
      </header>
      {isDrawThings && (
        <DrawThingsSettingsBar
          settings={drawSettings}
          onChange={setDrawSettings}
        />
      )}
      <main className="layout">
        <ThreadSidebar
          threads={threadList.threads}
          activeThreadId={activeThreadId}
          onSelect={openThread}
          onNewChat={startNewChat}
          onDelete={removeThread}
        />
        <div className="thread-container">
          {error && <div className="status">⚠ {error}</div>}
          {!error && !ready && <div className="status">Loading…</div>}
          {ready && (
            <Chat
              key={chatKey}
              apiUrl={API_URL}
              modelId={modelId!}
              promptId={promptId!}
              modelError={modelHealthError}
              drawSettings={drawSettings}
              initialThreadId={activeThreadId}
              initialMessages={initialMessages}
              onThreadCreated={onThreadCreated}
              welcomeMessage={activePrompt?.welcomeMessage}
            />
          )}
        </div>
      </main>
    </>
  );
}

function freshKey(): string {
  return `new-${crypto.randomUUID()}`;
}
