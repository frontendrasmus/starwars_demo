import { useMemo } from "react";
import type { ThreadDescriptor } from "@chat-demo/shared";

interface Props {
  threads: ThreadDescriptor[];
  activeThreadId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}

/**
 * Left-rail thread list. Threads are bucketed by relative date and the
 * active one is highlighted in the accent. Each row shows a delete
 * button on hover (kept light so it doesn't compete with the title).
 *
 * Empty (zero-message) threads are filtered out — they're created
 * server-side at "+ New chat" time but only show up once the user has
 * actually said something.
 */
export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelect,
  onNewChat,
  onDelete,
}: Props) {
  const buckets = useMemo(() => groupByDate(threads), [threads]);

  return (
    <aside className="sidebar" aria-label="Chat history">
      <button type="button" className="sidebar-new" onClick={onNewChat}>
        <span className="sidebar-new-plus" aria-hidden>+</span> New chat
      </button>

      <div className="sidebar-list">
        {buckets.length === 0 && (
          <p className="sidebar-empty">No conversations yet.</p>
        )}
        {buckets.map(({ label, items }) => (
          <section key={label} className="sidebar-bucket">
            <h2 className="sidebar-bucket-label">{label}</h2>
            <ul>
              {items.map((t) => (
                <ThreadRow
                  key={t.id}
                  thread={t}
                  active={t.id === activeThreadId}
                  onSelect={() => onSelect(t.id)}
                  onDelete={() => onDelete(t.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}

function ThreadRow({
  thread,
  active,
  onSelect,
  onDelete,
}: {
  thread: ThreadDescriptor;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const isImage = thread.modelId.startsWith("drawthings/");
  const icon = isImage ? "🎨" : "📄";
  const title = thread.title || "Untitled chat";

  return (
    <li className={`sidebar-item${active ? " sidebar-item-active" : ""}`}>
      <button type="button" className="sidebar-item-trigger" onClick={onSelect}>
        <span className="sidebar-item-icon" aria-hidden>{icon}</span>
        <span className="sidebar-item-title">{title}</span>
      </button>
      <button
        type="button"
        className="sidebar-item-delete"
        title="Delete this conversation"
        aria-label={`Delete "${title}"`}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete "${title}"? This cannot be undone.`)) onDelete();
        }}
      >
        ×
      </button>
    </li>
  );
}

/* ── Date bucketing ─────────────────────────────────────────────── */

interface Bucket {
  label: string;
  items: ThreadDescriptor[];
}

function groupByDate(threads: ThreadDescriptor[]): Bucket[] {
  const visible = threads.filter((t) => t.messageCount > 0);
  if (visible.length === 0) return [];

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - 7 * 86_400_000;
  const monthStart = todayStart - 30 * 86_400_000;

  const buckets: Record<string, ThreadDescriptor[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    "This month": [],
    Older: [],
  };

  for (const t of visible) {
    if (t.updatedAt >= todayStart) buckets.Today!.push(t);
    else if (t.updatedAt >= yesterdayStart) buckets.Yesterday!.push(t);
    else if (t.updatedAt >= weekStart) buckets["This week"]!.push(t);
    else if (t.updatedAt >= monthStart) buckets["This month"]!.push(t);
    else buckets.Older!.push(t);
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
