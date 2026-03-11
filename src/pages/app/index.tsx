import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorLayout } from "@/layouts";
import { useApp } from "@/hooks";
import { useApp as useAppContext } from "@/contexts";
import { useCompletion } from "@/hooks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CustomCursor } from "@/components";
import { getPlatform } from "@/lib";
import { TopBar } from "./components/TopBar";
import { AIChatMode } from "./components/AIChatMode";
import { ChatInputBar } from "./components/ChatInputBar";
import { SystemAudio, AudioVisualizer, StatusIndicator } from "./components";

export type AppMode = "ai" | "todo" | "meeting" | "chill";

const App = () => {
  const { isHidden, systemAudio } = useApp();
  const { customizable, toggleAlwaysOnTop } = useAppContext();
  const platform = getPlatform();
  const [mode, setMode] = useState<AppMode>("ai");

  const completion = useCompletion();

  const closeWindow = async () => {
    try {
      await getCurrentWindow().hide();
    } catch (e) {
      console.error("Failed to hide window:", e);
    }
  };

  return (
    <ErrorBoundary
      fallbackRender={() => <ErrorLayout isCompact />}
      resetKeys={["app-error"]}
      onReset={() => console.log("Reset")}
    >
      <div
        className={`w-screen h-screen flex flex-col bg-white rounded-2xl overflow-hidden ${
          isHidden ? "hidden pointer-events-none" : ""
        }`}
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
      >
        <TopBar
          mode={mode}
          onModeChange={setMode}
          isPinned={customizable.alwaysOnTop.isEnabled}
          onTogglePin={() =>
            toggleAlwaysOnTop(!customizable.alwaysOnTop.isEnabled)
          }
          onClose={closeWindow}
        />

        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white">
          {mode === "ai" && (
            <AIChatMode
              {...completion}
              onSuggestionClick={(text) => {
                completion.setInput(text);
                setTimeout(() => completion.submit(), 50);
              }}
            />
          )}

          {mode === "todo" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 p-8">
              <span className="text-5xl">✓</span>
              <p className="text-sm font-medium text-gray-500">Todo mode</p>
              <p className="text-xs text-center text-gray-400">Coming soon</p>
            </div>
          )}

          {mode === "meeting" && (
            <div className="flex-1 flex flex-col gap-3 p-4 overflow-auto">
              <SystemAudio {...systemAudio} />
              {systemAudio?.capturing && (
                <div className="flex flex-col gap-2">
                  <AudioVisualizer isRecording={systemAudio.capturing} />
                  <StatusIndicator
                    setupRequired={systemAudio.setupRequired}
                    error={systemAudio.error}
                    isProcessing={systemAudio.isProcessing}
                    isAIProcessing={systemAudio.isAIProcessing}
                    capturing={systemAudio.capturing}
                  />
                </div>
              )}
            </div>
          )}

          {mode === "chill" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 p-8">
              <span className="text-5xl">🌊</span>
              <p className="text-sm font-medium text-gray-500">Chill mode</p>
              <p className="text-xs text-center text-gray-400">Coming soon</p>
            </div>
          )}
        </div>

        {mode === "ai" && <ChatInputBar {...completion} />}

        {customizable.cursor.type === "invisible" && platform !== "linux" && (
          <CustomCursor />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
