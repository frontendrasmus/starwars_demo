import { useEffect, useState } from "react";
import type { ModelDescriptor, ModelId } from "@chat-demo/shared";
import { Chat } from "./components/Chat.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export function App() {
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [modelId, setModelId] = useState<ModelId | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch the supported models from the backend on mount. Keeping this
  // list server-owned means the UI can never request a model the backend
  // can't serve — one of the small payoffs of having a backend at all.
  useEffect(() => {
    fetch(`${API_URL}/api/models`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ models: ModelDescriptor[] }>;
      })
      .then(({ models }) => {
        setModels(models);
        if (models[0]) setModelId(models[0].id);
      })
      .catch((err) => setError(`Could not reach API at ${API_URL}: ${err.message}`));
  }, []);

  return (
    <>
      <header className="header">
        <h1>Chat demo v1</h1>
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
        {!error && !modelId && <div className="status">Loading models…</div>}
        {modelId && <Chat apiUrl={API_URL} modelId={modelId} />}
      </div>
    </>
  );
}
