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

interface ChatProps {
  apiUrl: string;
  modelId: ModelId;
  promptId: PromptId;
}


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


  const aui = useAui({ tools: Tools({ toolkit }) });

  return (
    <AssistantRuntimeProvider runtime={runtime} aui={aui}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}


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
