import { useEffect, useState } from "react";
import type {
  ModelDescriptor,
  ModelId,
  PromptDescriptor,
  PromptId,
} from "@chat-demo/shared";
import { Chat } from "./components/Chat.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export function App() {
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [prompts, setPrompts] = useState<PromptDescriptor[]>([]);
  const [modelId, setModelId] = useState<ModelId | null>(null);
  const [promptId, setPromptId] = useState<PromptId | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch both registries in parallel on mount. Keeping these server-owned
  // means the UI can never request a model or prompt the backend doesn't
  // support — one of the small payoffs of having a backend at all.
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

  const ready = modelId && promptId;

  return (
    <>
      <header className="header">
        <h1>Chat demo v2</h1>
        <select
          value={promptId ?? ""}
          onChange={(e) => setPromptId(e.target.value)}
          disabled={prompts.length === 0}
          aria-label="Select prompt"
          title={prompts.find((p) => p.id === promptId)?.description}
        >
          {prompts.map((p) => (
            <option key={p.id} value={p.id} title={p.description}>
              {p.label}
            </option>
          ))}
        </select>
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
      </header>
      <div className="thread-container">
        {error && <div className="status">⚠ {error}</div>}
        {!error && !ready && <div className="status">Loading…</div>}
        {ready && <Chat apiUrl={API_URL} modelId={modelId!} promptId={promptId!} />}
      </div>
    </>
  );
}
