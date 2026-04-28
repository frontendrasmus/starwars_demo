import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import type { ModelId, PromptId } from "@chat-demo/shared";

interface ChatProps {
  apiUrl: string;
  modelId: ModelId;
  promptId: PromptId;
}

/**
 * Wrapper that remounts the inner component when modelId OR promptId
 * changes. The transport is constructed once inside useChatRuntime, so
 * new header values wouldn't take effect on in-flight or queued requests.
 *
 * Remounting on prompt change is arguably stronger behaviour than remounting
 * on model change: switching from "SQL assistant" to "writing coach"
 * mid-thread would produce bizarre, confused replies. Fresh thread per
 * persona is the right default. Thread persistence comes in v5.
 */
export function Chat(props: ChatProps) {
  return <ChatInner key={`${props.modelId}::${props.promptId}`} {...props} />;
}

function ChatInner({ apiUrl, modelId, promptId }: ChatProps) {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: `${apiUrl}/api/chat`,
      headers: {
        "x-model-id": modelId,
        "x-prompt-id": promptId,
      },
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}

// assistant-ui 0.12 dropped the styled <Thread />; compose our own from
// primitives. Intentionally minimal — swap for `npx assistant-ui init`
// output if you want the Tailwind + shadcn version.
function Thread() {
  return (
    <ThreadPrimitive.Root className="thread-root">
      <ThreadPrimitive.Viewport className="thread-viewport">
        <ThreadPrimitive.Messages
          components={{ UserMessage, AssistantMessage }}
        />
      </ThreadPrimitive.Viewport>
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

function UserMessage() {
  return (
    <MessagePrimitive.Root className="message message-user">
      <MessagePrimitive.Parts />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="message message-assistant">
      <MessagePrimitive.Parts />
    </MessagePrimitive.Root>
  );
}
