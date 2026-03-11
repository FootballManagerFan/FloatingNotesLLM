import { useRef, useState } from "react";
import {
  PlusIcon,
  SendIcon,
  MonitorIcon,
  Loader2Icon,
  ChevronDownIcon,
  XIcon,
} from "lucide-react";
import { UseCompletionReturn } from "@/types";
import { useApp as useAppContext } from "@/contexts";

interface ChatInputBarProps extends UseCompletionReturn {}

export const ChatInputBar = ({
  input,
  setInput,
  submit,
  isLoading,
  cancel,
  attachedFiles,
  removeFile,
  handleFileSelect,
  captureScreenshot,
  isScreenshotLoading,
  handlePaste,
  handleKeyPress,
}: ChatInputBarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const { allAiProviders, selectedAIProvider, onSetSelectedAIProvider } =
    useAppContext();

  const selectedProvider = allAiProviders.find(
    (p) => p.id === selectedAIProvider.provider
  );

  const providerLabel = selectedProvider?.name ?? "Select model";
  // Show a shortened label: "GPT-4o" → truncate at 10 chars
  const shortLabel =
    providerLabel.length > 12 ? providerLabel.slice(0, 12) + "…" : providerLabel;

  return (
    <div className="px-3 pb-3 pt-1 bg-white border-t border-gray-100 shrink-0">
      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="flex gap-1.5 mb-2 flex-wrap pt-1">
          {attachedFiles.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-1 text-xs bg-[#f1f3f4] rounded-lg px-2 py-1 text-gray-600"
            >
              <span className="max-w-[120px] truncate">{f.name}</span>
              <button
                onClick={() => removeFile(f.id)}
                className="text-gray-400 hover:text-gray-600 ml-0.5"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input card */}
      <div className="rounded-2xl border border-gray-200 bg-[#f8f9fa] overflow-hidden focus-within:border-gray-300 transition-colors">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!isLoading && input.trim()) submit();
            }
          }}
          onPaste={handlePaste as any}
          placeholder="Type @ to ask about a tab"
          rows={2}
          disabled={isLoading}
          className="w-full bg-transparent px-4 pt-3 pb-1 text-sm text-gray-800 placeholder:text-[#5f6368] resize-none outline-none disabled:opacity-60 leading-relaxed"
        />

        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
          {/* Left: attach + screenshot */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-[#5f6368] hover:bg-gray-200 hover:text-gray-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
            </button>

            <button
              onClick={captureScreenshot}
              disabled={isScreenshotLoading}
              title="Screenshot"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-[#5f6368] hover:bg-gray-200 hover:text-gray-700 transition-colors disabled:opacity-40"
            >
              {isScreenshotLoading ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <MonitorIcon className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Right: model selector + send */}
          <div className="flex items-center gap-1.5">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelPicker((v) => !v)}
                className="flex items-center gap-1 text-xs text-[#5f6368] hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-200 transition-colors"
                title="Select AI model"
              >
                <span>{shortLabel}</span>
                <ChevronDownIcon className="h-3 w-3" />
              </button>

              {showModelPicker && (
                <>
                  {/* Click-outside backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowModelPicker(false)}
                  />
                  <div className="absolute bottom-full right-0 mb-1.5 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 min-w-[180px] max-h-52 overflow-y-auto">
                    {allAiProviders.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSetSelectedAIProvider({
                            provider: p.id,
                            variables: {},
                          });
                          setShowModelPicker(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-[#f1f3f4] transition-colors ${
                          p.id === selectedAIProvider.provider
                            ? "text-[#1a73e8] font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Send / Cancel */}
            <button
              onClick={isLoading ? cancel : () => { if (input.trim()) submit(); }}
              disabled={!isLoading && !input.trim()}
              title={isLoading ? "Cancel" : "Send (Enter)"}
              className="flex items-center justify-center w-7 h-7 rounded-xl bg-[#1a73e8] hover:bg-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isLoading ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SendIcon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
};
