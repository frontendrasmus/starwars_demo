import { useEffect, useMemo, useState } from "react";
import type {
  ModelDescriptor,
  ModelId,
  PromptDescriptor,
  PromptId,
} from "@chat-demo/shared";
import { Chat, type DrawThingsSettings } from "./components/Chat.js";
import { DrawThingsSettingsBar } from "./components/DrawThingsSettingsBar.js";
import { KnowledgePanel } from "./components/KnowledgePanel.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export function App() {
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [prompts, setPrompts] = useState<PromptDescriptor[]>([]);
  const [modelId, setModelId] = useState<ModelId | null>(null);
  const [promptId, setPromptId] = useState<PromptId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelHealthError, setModelHealthError] = useState<string | null>(null);
  // Draw Things generation settings — surfaced as a sub-toolbar when a
  // drawthings/* model is selected. State lives at App level so settings
  // persist when the user toggles the model in and out.
  const [drawSettings, setDrawSettings] = useState<DrawThingsSettings>({
    steps: 4,
    width: 512,
    height: 512,
  });

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
      .catch((err) => setError(`Could not reach API at ${API_URL}: ${err.message}`));
  }, []);

  // When the user picks a "drawthings/*" model, ping the local Draw Things
  // process up front so they get an immediate, friendly error instead of a
  // 30-second timeout when they hit Send. Non-drawthings models clear the
  // banner and let the user keep typing.
  useEffect(() => {
    if (!modelId) return;
    const provider = modelId.split("/")[0];
    if (provider !== "drawthings") {
      setModelHealthError(null);
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/api/health/drawthings`)
      .then((r) => r.json() as Promise<{ ok: boolean; error?: string }>)
      .then((data) => {
        if (cancelled) return;
        setModelHealthError(data.ok ? null : data.error ?? "Draw Things is unreachable.");
      })
      .catch((err) => {
        if (!cancelled) setModelHealthError(`Health check failed: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  const ready = modelId && promptId;
  const isDrawThings = modelId?.startsWith("drawthings/") ?? false;
  const activePromptTools = useMemo(
    () => prompts.find((p) => p.id === promptId)?.tools ?? [],
    [prompts, promptId],
  );

  return (
    <>
      <header className="header">
        <h1>Chat demo <em>v4</em></h1>
        <span className="header-label">Assistant:</span>
        <select
          value={promptId ?? ""}
          onChange={(e) => setPromptId(e.target.value)}
          disabled={prompts.length === 0 || isDrawThings}
          aria-label="Select prompt"
          title={
            isDrawThings
              ? "Assistant prompts don't apply to Draw Things — its output is an image."
              : prompts.find((p) => p.id === promptId)?.description
          }
        >
          {prompts.map((p) => (
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
      <div className="thread-container">
        {error && <div className="status">⚠ {error}</div>}
        {!error && !ready && <div className="status">Loading…</div>}
        {ready && (
          <Chat
            apiUrl={API_URL}
            modelId={modelId!}
            promptId={promptId!}
            modelError={modelHealthError}
            drawSettings={drawSettings}
          />
        )}
      </div>
    </>
  );
}
