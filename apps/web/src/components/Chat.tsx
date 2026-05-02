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
import type { ModelId, PromptId } from "@chat-demo/shared";
import { toolkit } from "../tools/toolkit.js";

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
   * (e.g. Draw Things not running). Shown as a banner above the composer
   * so the user sees it before sending.
   */
  modelError?: string | null;
  /**
   * Generation settings for the Draw Things model. Forwarded as
   * x-drawthings-* request headers; the backend reads them in the
   * chat route and passes them to providers/drawthings.ts → generateImage.
   * Ignored for non-drawthings models.
   */
  drawSettings?: DrawThingsSettings;
}

export function Chat(props: ChatProps) {
  return <ChatInner key={`${props.modelId}::${props.promptId}`} {...props} />;
}

function ChatInner({ apiUrl, modelId, promptId, modelError, drawSettings }: ChatProps) {
  const isDrawThings = modelId.startsWith("drawthings/");
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: `${apiUrl}/api/chat`,
      headers: {
        "x-model-id": modelId,
        "x-prompt-id": promptId,
        ...(isDrawThings && drawSettings
          ? {
              "x-drawthings-steps": String(drawSettings.steps),
              "x-drawthings-width": String(drawSettings.width),
              "x-drawthings-height": String(drawSettings.height),
            }
          : {}),
      },
    }),
  });

  const aui = useAui({ tools: Tools({ toolkit }) });

  return (
    <AssistantRuntimeProvider runtime={runtime} aui={aui}>
      <Thread modelError={modelError} isDrawThings={isDrawThings} />
    </AssistantRuntimeProvider>
  );
}

function Thread({
  modelError,
  isDrawThings,
}: {
  modelError?: string | null;
  isDrawThings: boolean;
}) {
  return (
    <ThreadPrimitive.Root className="thread-root">
      <ThreadPrimitive.Viewport className="thread-viewport">
        <ThreadPrimitive.Messages
          components={{ UserMessage, AssistantMessage }}
        />
        {/*
          Thread-level loading indicator. ThreadPrimitive.If with
          `running` shows children only while the assistant is generating,
          which bridges the silent gap between the "Generating…" text part
          and the eventual file part for Draw Things — see
          https://www.assistant-ui.com/docs/primitives
        */}
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

// Render images inline; fall back to a download link for other file types.
// assistant-ui normalises the AI SDK's {url, mediaType} into its own
// {data, mimeType} shape and spreads the fields onto props directly.
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
      <MessagePrimitive.Parts components={{ File: FilePart }} />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="message message-assistant">
      <MessagePrimitive.Parts components={{ File: FilePart }} />
    </MessagePrimitive.Root>
  );
}
