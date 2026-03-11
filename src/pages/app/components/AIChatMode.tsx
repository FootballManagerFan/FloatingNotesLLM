import { useRef, useEffect } from "react";
import { Loader2Icon, PlusCircleIcon } from "lucide-react";
import { Markdown } from "@/components";
import { UseCompletionReturn } from "@/types";

const SUGGESTIONS = [
  "List preferred tech stack",
  "Describe core app features",
  "Explain benefits of Cursor",
];

interface AIChatModeProps extends UseCompletionReturn {
  onSuggestionClick: (text: string) => void;
}

export const AIChatMode = ({
  conversationHistory,
  response,
  isLoading,
  error,
  onSuggestionClick,
  startNewConversation,
  scrollAreaRef,
}: AIChatModeProps) => {
  const isEmpty =
    conversationHistory.length === 0 && !isLoading && !response && !error;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [response, conversationHistory.length]);

  return (
    <div
      ref={scrollAreaRef}
      className="flex-1 overflow-y-auto flex flex-col bg-white min-h-0"
    >
      {isEmpty ? (
        // flex-1 fills the scrollable viewport height so justify-center works
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-medium text-[#1a73e8] mb-1">
              Hello, max
            </h1>
            <p className="text-sm text-[#5f6368]">
              How can I help you today?
            </p>
          </div>

          <div className="w-full flex flex-col gap-2">
            {SUGGESTIONS.map((text) => (
              <button
                key={text}
                onClick={() => onSuggestionClick(text)}
                className="w-full text-left px-4 py-3 rounded-xl bg-[#f1f3f4] hover:bg-gray-200 text-sm text-gray-700 transition-colors"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Chat history ── */
        <div className="flex flex-col gap-3 px-4 py-4">
          {/* New chat button */}
          <div className="flex justify-end">
            <button
              onClick={startNewConversation}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors py-1 px-2 rounded-lg hover:bg-blue-50"
              title="Start new conversation"
            >
              <PlusCircleIcon className="h-3.5 w-3.5" />
              New chat
            </button>
          </div>

          {conversationHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-[11px] font-semibold shrink-0 mt-0.5">
                  AI
                </div>
              )}
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-[#1a73e8] text-white rounded-tr-sm"
                    : "bg-[#f1f3f4] text-gray-800 rounded-tl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Markdown>{msg.content}</Markdown>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))}

          {/* Streaming / loading bubble */}
          {(isLoading || response) && (
            <div className="flex gap-2.5 flex-row">
              <div className="w-7 h-7 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-[11px] font-semibold shrink-0 mt-0.5">
                AI
              </div>
              <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm bg-[#f1f3f4] text-gray-800 max-w-[85%]">
                {response ? (
                  isLoading ? (
                    <div className="whitespace-pre-wrap text-gray-700">
                      {response}
                    </div>
                  ) : (
                    <Markdown>{response}</Markdown>
                  )
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 py-0.5">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    <span>Thinking…</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};
