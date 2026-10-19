import React, { useRef, useState } from "react";
import type { Layout, Shot } from "../../doc/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  Icon,
} from "../../ui";
import {
  LayoutGrid,
  Monitor,
  Smartphone,
  Maximize2,
  GalleryHorizontal,
  GalleryVertical,
  Orbit,
} from "lucide-react";
import { ShotThumbnail } from "../thumbnails/ShotThumbnail";
import { shotSummary } from "../labels";

export interface ShotCardProps {
  shot: Shot;
  index: number;
  isSelected: boolean;
  widthPx: number;
  pxPerSecond: number;
  onSelect: () => void;
  onDurationChange: (newDuration: number) => void;
  onChangeLayout: (layout: Layout) => void;
}

export const ShotCard: React.FC<ShotCardProps> = ({
  shot,
  index,
  isSelected,
  widthPx,
  pxPerSecond,
  onSelect,
  onDurationChange,
  onChangeLayout,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [dragDuration, setDragDuration] = useState<number | null>(null);

  const resizeStartXRef = useRef(0);
  const initialDurationRef = useRef(shot.duration);

  const layout = shot.layout;
  const layoutKind = layout.kind;
  const device = layoutKind === "single" ? layout.device : null;

  // Active duration (either while dragging or committed)
  const currentDuration = dragDuration ?? shot.duration;
  const cardWidth = dragDuration !== null ? dragDuration * pxPerSecond : widthPx;

  // --- Duration resize handle handlers ---
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    initialDurationRef.current = shot.duration;
    setDragDuration(shot.duration);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing) return;
    const dx = e.clientX - resizeStartXRef.current;
    const dDuration = dx / pxPerSecond;
    let nextDuration = initialDurationRef.current + dDuration;

    // Snap: 0.1s normally, 0.5s if Shift is held
    const snap = e.shiftKey ? 0.5 : 0.1;
    nextDuration = Math.round(nextDuration / snap) * snap;
    nextDuration = Math.max(1.0, Math.min(30.0, nextDuration));

    setDragDuration(Number(nextDuration.toFixed(2)));
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isResizing) {
      setIsResizing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (dragDuration !== null && dragDuration !== shot.duration) {
        onDurationChange(dragDuration);
      }
      setDragDuration(null);
    }
  };

  // --- Keyboard selection ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  // Header icon for device/layout
  const getLayoutIcon = () => {
    switch (layoutKind) {
      case "single":
        if (device === "phone") return <Icon icon={Smartphone} size={13} />;
        return <Icon icon={Monitor} size={13} />;
      case "rows":
      case "columns":
        return <Icon icon={LayoutGrid} size={13} />;
      case "slider":
        return <Icon icon={layout.axis === "y" ? GalleryVertical : GalleryHorizontal} size={13} />;
      case "orbit":
        return <Icon icon={Orbit} size={13} />;
      default:
        return <Icon icon={Monitor} size={13} />;
    }
  };

  const subLabel = shotSummary(shot);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="group"
          data-testid="shot-card"
          tabIndex={0}
          aria-label={`Shot ${index + 1}: ${subLabel}, duration ${currentDuration.toFixed(1)} seconds`}
          onClick={onSelect}
          onKeyDown={handleKeyDown}
          style={{ width: `${Math.max(120, cardWidth)}px` }}
          className={`group relative h-full shrink-0 flex flex-col justify-between rounded-lg border transition-all cursor-pointer select-none outline-none overflow-hidden ${
            isSelected
              ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]/20 shadow-xs ring-1 ring-[var(--color-accent)]/50"
              : "border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-line-strong)]"
          }`}
        >
          {/* Main Card Body: the shot at its local midpoint (F07), details beside it */}
          <div className="p-1.5 flex-1 min-h-0 flex gap-2 overflow-hidden">
            <ShotThumbnail
              shot={shot}
              className="h-full shrink-0 rounded overflow-hidden bg-[var(--color-bg)] border border-[var(--color-line)]/60"
            />

            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              {/* Top row: Shot title, device icon, duration */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-semibold text-[var(--color-text)] truncate">
                    Shot {index + 1}
                  </span>
                  <span className="text-[var(--color-text-3)] shrink-0">{getLayoutIcon()}</span>
                  <span className="text-[10px] font-mono text-[var(--color-text-3)] shrink-0">
                    {currentDuration.toFixed(1)}s
                  </span>
                </div>{" "}
              </div>

              {/* Footer: device or layout, and camera move. */}
              <div className="text-[10px] text-[var(--color-text-3)] font-mono min-w-0 truncate">
                {subLabel}
              </div>
            </div>
          </div>

          {/* Right Duration Resize Handle. A slider's or orbit's length is screenshots × step. */}
          {layoutKind !== "slider" && layoutKind !== "orbit" && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Drag to change shot duration"
              title="Drag to change shot duration"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              className="absolute top-0 bottom-0 right-0 w-2.5 hover:w-3 bg-transparent hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 cursor-ew-resize flex items-center justify-center transition-all z-20"
            >
              <div className="w-[2px] h-4 rounded-full bg-[var(--color-line-strong)] group-hover:bg-[var(--color-accent)]" />
            </div>
          )}

          {/* Live duration tooltip while dragging */}
          {isResizing && dragDuration !== null && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-2 py-1 rounded bg-[var(--color-panel)] border border-[var(--color-accent)] text-[11px] font-mono font-bold text-[var(--color-accent)] shadow-xl pointer-events-none">
              {dragDuration.toFixed(1)}s
            </div>
          )}
        </div>
      </ContextMenuTrigger>

      {/* Context Menu */}
      <ContextMenuContent>
        {/* Change layout submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger icon={<Icon icon={LayoutGrid} size={13} />}>
            Change layout
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              icon={<Icon icon={Monitor} size={12} />}
              onClick={() => onChangeLayout({ kind: "single", device: "browser", assetId: "" })}
            >
              Browser
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Icon icon={Smartphone} size={12} />}
              onClick={() => onChangeLayout({ kind: "single", device: "phone", assetId: "" })}
            >
              Phone
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Icon icon={Maximize2} size={12} />}
              onClick={() => onChangeLayout({ kind: "single", device: "card", assetId: "" })}
            >
              Card
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
};
