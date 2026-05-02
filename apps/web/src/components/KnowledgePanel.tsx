import { useEffect, useState } from "react";

interface KnowledgeSummary {
  source: string;
  chunkCount: number;
  totalChars: number;
}

interface Props {
  apiUrl: string;
}

/**
 * A small panel that hangs off the header. Lets the user paste in some
 * text under a source label, which the backend chunks + embeds locally.
 *
 * No file upload widget for v4 — paste-in is enough to demo the flow,
 * and avoids the multipart parsing detour. Hooking up real file upload
 * is a one-line aside on stage and ~20 lines of backend code.
 */
export function KnowledgePanel({ apiUrl }: Props) {
  const [sources, setSources] = useState<KnowledgeSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/knowledge`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sources: KnowledgeSummary[] };
      setSources(data.sources);
    } catch (err) {
      console.error("Failed to load knowledge", err);
    }
  };

  useEffect(() => {
    void refresh();
  }, [apiUrl]);

  const submit = async () => {
    if (!source.trim() || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: source.trim(), text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSource("");
      setText("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!confirm("Clear all indexed documents?")) return;
    await fetch(`${apiUrl}/api/knowledge`, { method: "DELETE" });
    await refresh();
  };

  const totalChunks = sources.reduce((s, x) => s + x.chunkCount, 0);

  return (
    <div className="knowledge-panel">
      <button
        type="button"
        className="knowledge-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        📚 knowledge ({sources.length} doc{sources.length === 1 ? "" : "s"},{" "}
        {totalChunks} chunk{totalChunks === 1 ? "" : "s"})
      </button>
      {open && (
        <div className="knowledge-body">
          <p className="knowledge-note">
            Embeddings are computed locally. Document content stays on this
            machine; only snippets the model chooses to use are sent in
            chat.
          </p>
          <div className="knowledge-list">
            {sources.length === 0 && (
              <div className="knowledge-empty">No documents indexed.</div>
            )}
            {sources.map((s) => (
              <div key={s.source} className="knowledge-item">
                <span className="knowledge-source">{s.source}</span>
                <span className="knowledge-stats">
                  {s.chunkCount} chunks · {s.totalChars.toLocaleString()} chars
                </span>
              </div>
            ))}
          </div>
          <input
            className="knowledge-input"
            type="text"
            placeholder="Source label (e.g. 'meeting-notes-q3')"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={busy}
          />
          <textarea
            className="knowledge-textarea"
            placeholder="Paste text here to add to the local knowledge base…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            disabled={busy}
          />
          {error && <div className="knowledge-error">⚠ {error}</div>}
          <div className="knowledge-actions">
            <button type="button" onClick={submit} disabled={busy || !source || !text}>
              {busy ? "Indexing…" : "Index"}
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={busy || sources.length === 0}
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
