import { GripVerticalIcon } from "lucide-react";
import { Button } from "@/components";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const DragButton = () => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    getCurrentWindow().startDragging().catch(() => {});
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="-ml-[2px] w-fit shrink-0 cursor-grab active:cursor-grabbing"
      data-bar-grip
      onMouseDown={handleMouseDown}
    >
      <GripVerticalIcon className="h-4 w-4" />
    </Button>
  );
};
