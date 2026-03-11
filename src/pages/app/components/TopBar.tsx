import {
  MessageCircleIcon,
  ListTodoIcon,
  VideoIcon,
  WavesIcon,
  PinIcon,
  PinOffIcon,
  MinusIcon,
  XIcon,
  MoreHorizontalIcon,
  Maximize2Icon,
  Minimize2Icon,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";
import { AppMode } from "../index";

const MODES: { id: AppMode; icon: React.ElementType; label: string }[] = [
  { id: "ai", icon: MessageCircleIcon, label: "AI Chat" },
  { id: "todo", icon: ListTodoIcon, label: "Todo" },
  { id: "meeting", icon: VideoIcon, label: "Meeting" },
  { id: "chill", icon: WavesIcon, label: "Chill" },
];

interface TopBarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isPinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}

const BarBtn = ({
  onClick,
  title,
  danger,
  children,
}: {
  onClick?: () => void;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
      danger
        ? "text-gray-400 hover:bg-red-50 hover:text-red-500"
        : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
    }`}
  >
    {children}
  </button>
);

export const TopBar = ({
  mode,
  onModeChange,
  isPinned,
  onTogglePin,
  onClose,
}: TopBarProps) => {
  const currentModeIdx = MODES.findIndex((m) => m.id === mode);
  const CurrentModeIcon = MODES[currentModeIdx].icon;
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setIsMaximized).catch(() => {});
    const unlisten = win.onResized(() => {
      win.isMaximized().then(setIsMaximized).catch(() => {});
    });
    return () => { unlisten.then((fn) => fn()).catch(() => {}); };
  }, []);

  const toggleMaximize = () => {
    const win = getCurrentWindow();
    if (isMaximized) {
      win.unmaximize().catch(() => {});
    } else {
      win.maximize().catch(() => {});
    }
  };

  const cycleMode = () => {
    const next = MODES[(currentModeIdx + 1) % MODES.length];
    onModeChange(next.id);
  };

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    getCurrentWindow()
      .startDragging()
      .catch(() => {});
  };

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-white shrink-0 select-none"
      onMouseDown={startDrag}
      style={{ cursor: "grab" }}
    >
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold shrink-0 mr-1">
        P
      </div>

      {/* Draggable spacer */}
      <div className="flex-1" />

      {/* Menu (placeholder) */}
      <BarBtn title="Menu">
        <MoreHorizontalIcon className="h-4 w-4" />
      </BarBtn>

      {/* Pin */}
      <BarBtn
        onClick={onTogglePin}
        title={isPinned ? "Unpin window" : "Keep on top"}
      >
        {isPinned ? (
          <PinIcon className="h-4 w-4 text-blue-500" />
        ) : (
          <PinOffIcon className="h-4 w-4" />
        )}
      </BarBtn>

      {/* Mode toggle */}
      <BarBtn
        onClick={cycleMode}
        title={`${MODES[currentModeIdx].label} — click to cycle`}
      >
        <CurrentModeIcon className="h-4 w-4" />
      </BarBtn>

      {/* Minimize */}
      <BarBtn
        onClick={() => getCurrentWindow().minimize().catch(() => {})}
        title="Minimize"
      >
        <MinusIcon className="h-4 w-4" />
      </BarBtn>

      {/* Maximize / Restore */}
      <BarBtn onClick={toggleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
        {isMaximized ? (
          <Minimize2Icon className="h-4 w-4" />
        ) : (
          <Maximize2Icon className="h-4 w-4" />
        )}
      </BarBtn>

      {/* Close */}
      <BarBtn onClick={onClose} title="Close" danger>
        <XIcon className="h-4 w-4" />
      </BarBtn>
    </div>
  );
};
