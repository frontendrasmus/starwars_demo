import { AssistantRuntimeProvider, Thread } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import type { ModelId } from "@chat-demo/shared";

interface ChatProps {
  apiUrl: string;
  modelId: ModelId;
}

/**
 * Wrapper that remounts the inner component when modelId changes.
 *
 * The transport is constructed once inside useChatRuntime; passing a new
 * modelId via headers wouldn't take effect on in-flight requests. Remounting
 * is the simplest correct behaviour for v1 — yes, you lose the thread when
 * you switch models. That's a v5 persistence concern, not a v1 concern.
 */
export function Chat(props: ChatProps) {
  return <ChatInner key={props.modelId} {...props} />;
}

function ChatInner({ apiUrl, modelId }: ChatProps) {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: `${apiUrl}/api/chat`,
      // Model selection rides on a header. The backend's CORS config
      // explicitly allows `x-model-id` in allowHeaders.
      headers: { "x-model-id": modelId },
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
