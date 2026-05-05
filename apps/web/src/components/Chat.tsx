import { useRef } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  Tools,
  useAui,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import type { UIMessage } from "ai";
import type {
  AttractionsData,
  BrochureData,
  CostsData,
  ModelId,
  PersistedMessage,
  PromptId,
  ThreadDescriptor,
} from "@chat-demo/shared";
import { toolkit } from "../tools/toolkit.js";
import { AttractionsCard } from "./AttractionsCard.js";
import { BrochureCard } from "./BrochureCard.js";
import { CostsCard } from "./CostsCard.js";

export interface DrawThingsSettings {
  steps: number;
  width: number;
  height: number;
}

interface ChatProps {
  apiUrl: string;
  modelId: ModelId;
  promptId: PromptId;
  /**
   * Backend-side liveness error for the currently selected model
   * (e.g. Draw Things not running). Shown as a banner above the composer.
   */
  modelError?: string | null;
  /**
   * Generation knobs for the Draw Things model, forwarded as headers.
   * Ignored for non-drawthings models.
   */
  drawSettings?: DrawThingsSettings;
  /**
   * Initial thread id — `null` means "no thread yet, mint one on first send".
   * Read once on mount; pass a new key to <Chat> to switch threads.
   */
  initialThreadId: string | null;
  /** Persisted messages to hydrate the runtime with. */
  initialMessages: PersistedMessage[];
  /** Fires the first time this Chat instance auto-creates a thread. */
  onThreadCreated?: (thread: ThreadDescriptor) => void;
  /**
   * Intro message displayed inside the empty thread (e.g. for special
   * workflow prompts). Disappears as soon as any real message arrives,
   * via assistant-ui's <ThreadPrimitive.If empty>. Never sent to the
   * model.
   */
  welcomeMessage?: string;
}

export function Chat(props: ChatProps) {
  // No inner re-key. App.tsx owns the only re-mount key (chatKey) and
  // changes it ONLY on user navigation (+ New chat / sidebar click).
  // Crucially, when this Chat lazy-creates a thread on first send and
  // App's activeThreadId flips from null → the new id, we MUST NOT remount
  // — the in-flight runtime + user message would be discarded.
  return <ChatInner {...props} />;
}

function ChatInner({
  apiUrl,
  modelId,
  promptId,
  modelError,
  drawSettings,
  initialThreadId,
  initialMessages,
  onThreadCreated,
  welcomeMessage,
}: ChatProps) {
  const isDrawThings = modelId.startsWith("drawthings/");

  // Mutable thread id. Starts as the prop; the headers function fills it
  // in when we lazy-create a thread on first send.
  const threadIdRef = useRef<string | null>(initialThreadId);

  // Hydrate prior messages into the assistant-ui shape.
  const hydrated: UIMessage[] = initialMessages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.parts as UIMessage["parts"],
  }));

  const runtime = useChatRuntime({
    messages: hydrated,
    transport: new AssistantChatTransport({
      api: `${apiUrl}/api/chat`,
      headers: async () => {
        const base: Record<string, string> = {
          "x-model-id": modelId,
          "x-prompt-id": promptId,
          ...(isDrawThings && drawSettings
            ? {
                "x-drawthings-steps": String(drawSettings.steps),
                "x-drawthings-width": String(drawSettings.width),
                "x-drawthings-height": String(drawSettings.height),
              }
            : {}),
        };

        let id = threadIdRef.current;
        if (!id) {
          // Lazy auto-create. Happens once per "+ New chat" → first send.
          const res = await fetch(`${apiUrl}/api/threads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modelId, promptId }),
          });
          if (!res.ok) {
            throw new Error(`Could not create thread: HTTP ${res.status}`);
          }
          const created = (await res.json()) as ThreadDescriptor;
          threadIdRef.current = created.id;
          id = created.id;
          onThreadCreated?.(created);
        }

        return { ...base, "x-thread-id": id };
      },
    }),
  });

  const aui = useAui({ tools: Tools({ toolkit }) });

  return (
    <AssistantRuntimeProvider runtime={runtime} aui={aui}>
      <Thread
        modelError={modelError}
        isDrawThings={isDrawThings}
        welcomeMessage={welcomeMessage}
      />
    </AssistantRuntimeProvider>
  );
}

function Thread({
  modelError,
  isDrawThings,
  welcomeMessage,
}: {
  modelError?: string | null;
  isDrawThings: boolean;
  welcomeMessage?: string;
}) {
  return (
    <ThreadPrimitive.Root className="thread-root">
      <ThreadPrimitive.If running>
        <div className="progress-strip" aria-hidden />
      </ThreadPrimitive.If>
      <ThreadPrimitive.Viewport className="thread-viewport">
        {welcomeMessage && (
          <ThreadPrimitive.If empty>
            <div className="welcome-message" aria-label="Prompt instructions">
              <span className="welcome-kicker">Intro</span>
              <p>{welcomeMessage}</p>
            </div>
          </ThreadPrimitive.If>
        )}
        <ThreadPrimitive.Messages
          components={{ UserMessage, AssistantMessage }}
        />
        <ThreadPrimitive.If running>
          <div
            className={`thread-loading${isDrawThings ? " thread-loading-image" : ""}`}
            aria-live="polite"
          >
            <span className="loading-dots" aria-hidden>
              <span /><span /><span />
            </span>
            <span>
              {isDrawThings
                ? "Draw Things is rendering your image…"
                : "Thinking…"}
            </span>
          </div>
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>
      {modelError && (
        <div className="model-error" role="alert">
          ⚠ {modelError}
        </div>
      )}
      <ComposerPrimitive.Root className="composer-root">
        <ComposerPrimitive.Input
          className="composer-input"
          placeholder="Ask anything…"
        />
        <ComposerPrimitive.Send className="composer-send">
          Send
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}

function FilePart(props: {
  mimeType: string;
  data: string;
  filename?: string;
}) {
  const { mimeType, data, filename } = props;
  if (mimeType.startsWith("image/")) {
    return (
      <img
        className="generated-image"
        src={data}
        alt={filename ?? "Generated image"}
      />
    );
  }
  return (
    <a href={data} download={filename ?? true} className="file-link">
      📎 {filename ?? "Download file"}
    </a>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="message message-user">
      <MessagePrimitive.Parts
        components={{
          File: FilePart,
          data: {
            by_name: {
              // Each `data-<name>` part type maps to a custom widget.
              // Adding more rich widgets later is just another by_name entry.
              brochure: ({ data }: { data: BrochureData }) => (
                <BrochureCard data={data} />
              ),
              attractions: ({ data }: { data: AttractionsData }) => (
                <AttractionsCard data={data} />
              ),
              costs: ({ data }: { data: CostsData }) => (
                <CostsCard data={data} />
              ),
            },
          },
        }}
      />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="message message-assistant">
      <MessagePrimitive.Parts
        components={{
          File: FilePart,
          data: {
            by_name: {
              // Each `data-<name>` part type maps to a custom widget.
              // Adding more rich widgets later is just another by_name entry.
              brochure: ({ data }: { data: BrochureData }) => (
                <BrochureCard data={data} />
              ),
              attractions: ({ data }: { data: AttractionsData }) => (
                <AttractionsCard data={data} />
              ),
              costs: ({ data }: { data: CostsData }) => (
                <CostsCard data={data} />
              ),
            },
          },
        }}
      />
    </MessagePrimitive.Root>
  );
}
