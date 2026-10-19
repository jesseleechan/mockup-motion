import React, { useRef, useState } from "react";
import type { Layout, Shot } from "../../doc/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  Icon,
  Tooltip,
} from "../../ui";
import {
  Copy,
  Laptop,
  Layers,
  LayoutGrid,
  Monitor,
  Scissors,
  Smartphone,
  Tablet,
  Trash2,
  Maximize2,
  Columns,
  GalleryHorizontal,
  GalleryVertical,
  Orbit,
} from "lucide-react";
import { ShotThumbnail } from "../thumbnails/ShotThumbnail";
import { LAYOUT_LABELS, shotSummary } from "../labels";

export interface ShotCardProps {
  shot: Shot;
  index: number;
  isSelected: boolean;
  widthPx: number;
  startSec: number;
  endSec: number;
  pxPerSecond: number;
  playhead: number;
  canDelete: boolean;
  onSelect: () => void;
  onDurationChange: (newDuration: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSplit: (splitLocalT: number) => void;
  onChangeLayout: (layout: Layout) => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
}

export const ShotCard: React.FC<ShotCardProps> = ({
  shot,
  index,
  isSelected,
  widthPx,
  startSec,
  endSec,
  pxPerSecond,
  playhead,
  canDelete,
  onSelect,
  onDurationChange,
  onReorder,
  onDuplicate,
  onDelete,
  onSplit,
  onChangeLayout,
  onNavigateLeft,
  onNavigateRight,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [dragDuration, setDragDuration] = useState<number | null>(null);
  const [dragOverSide, setDragOverSide] = useState<"left" | "right" | null>(null);

  const resizeStartXRef = useRef(0);
  const initialDurationRef = useRef(shot.duration);

  const layout = shot.layout;
  const layoutKind = layout.kind;
  const device = layoutKind === "single" ? layout.device : null;

  // Active duration (either while dragging or committed)
  const currentDuration = dragDuration ?? shot.duration;
  const cardWidth = dragDuration !== null ? dragDuration * pxPerSecond : widthPx;

  // Split eligibility
  const isPlayheadInShot = playhead >= startSec + 0.49 && playhead <= endSec - 0.49;
  const splitLocalT = playhead - startSec;

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

  // --- Drag and Drop Reordering ---
  const handleDragStart = (e: React.DragEvent) => {
    if (isResizing) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/x-mockupmotion-shot-index", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("application/x-mockupmotion-shot-index")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    setDragOverSide(e.clientX < midX ? "left" : "right");
  };

  const handleDragLeave = () => {
    setDragOverSide(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSide(null);
    const fromIndexStr = e.dataTransfer.getData("application/x-mockupmotion-shot-index");
    if (!fromIndexStr) return;
    const fromIndex = parseInt(fromIndexStr, 10);
    if (isNaN(fromIndex) || fromIndex === index) return;

    let targetIndex = index;
    if (dragOverSide === "right" && fromIndex < index) {
      targetIndex = index;
    } else if (dragOverSide === "left" && fromIndex > index) {
      targetIndex = index;
    }
    onReorder(fromIndex, targetIndex);
  };

  // --- Keyboard navigation ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onNavigateLeft?.();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onNavigateRight?.();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  // Header icon for device/layout
  const getLayoutIcon = () => {
    switch (layoutKind) {
      case "single":
        if (device === "phone") return <Icon icon={Smartphone} size={13} />;
        if (device === "tablet") return <Icon icon={Tablet} size={13} />;
        if (device === "laptop") return <Icon icon={Laptop} size={13} />;
        return <Icon icon={Monitor} size={13} />;
      case "pair":
        return <Icon icon={Columns} size={13} />;
      case "trio":
        return <Icon icon={Layers} size={13} />;
      case "rows":
      case "columns":
      case "wall":
      case "stack":
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
          draggable={!isResizing}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ width: `${Math.max(120, cardWidth)}px` }}
          className={`group relative h-full shrink-0 flex flex-col justify-between rounded-lg border transition-all cursor-pointer select-none outline-none overflow-hidden ${
            isSelected
              ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]/20 shadow-xs ring-1 ring-[var(--color-accent)]/50"
              : "border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-line-strong)]"
          } ${
            dragOverSide === "left"
              ? "border-l-4 border-l-[var(--color-accent)]"
              : dragOverSide === "right"
                ? "border-r-4 border-r-[var(--color-accent)]"
                : ""
          }`}
        >
          {/* Main Card Body: the shot at its local midpoint (F07), details beside it */}
          <div className="p-1.5 flex-1 min-h-0 flex gap-2 overflow-hidden">
            <ShotThumbnail
              shot={shot}
              className="h-full shrink-0 rounded overflow-hidden bg-[var(--color-bg)] border border-[var(--color-line)]/60"
            />

            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              {/* Top row: Shot title, device icon, quick actions */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-semibold text-[var(--color-text)] truncate">
                    Shot {index + 1}
                  </span>
                  <span className="text-[var(--color-text-3)] shrink-0">{getLayoutIcon()}</span>
                  <span className="text-[10px] font-mono text-[var(--color-text-3)] shrink-0">
                    {currentDuration.toFixed(1)}s
                  </span>
                </div>

                {/* Quick actions hover */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                  <Tooltip content="Duplicate shot">
                    <button
                      type="button"
                      aria-label="Duplicate shot"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate();
                      }}
                      className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text)] rounded hover:bg-[var(--color-hover)]"
                    >
                      <Icon icon={Copy} size={11} />
                    </button>
                  </Tooltip>
                  {canDelete && (
                    <Tooltip content="Delete shot">
                      <button
                        type="button"
                        aria-label="Delete shot"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                        }}
                        className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-danger)] rounded hover:bg-[var(--color-hover)]"
                      >
                        <Icon icon={Trash2} size={11} />
                      </button>
                    </Tooltip>
                  )}
                </div>
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
        <ContextMenuItem icon={<Icon icon={Copy} size={13} />} onClick={onDuplicate}>
          Duplicate
        </ContextMenuItem>

        {canDelete && (
          <ContextMenuItem danger icon={<Icon icon={Trash2} size={13} />} onClick={onDelete}>
            Delete
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

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
              icon={<Icon icon={Tablet} size={12} />}
              onClick={() => onChangeLayout({ kind: "single", device: "tablet", assetId: "" })}
            >
              Tablet
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Icon icon={Laptop} size={12} />}
              onClick={() => onChangeLayout({ kind: "single", device: "laptop", assetId: "" })}
            >
              Laptop
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Icon icon={Maximize2} size={12} />}
              onClick={() => onChangeLayout({ kind: "single", device: "card", assetId: "" })}
            >
              Card
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              icon={<Icon icon={Columns} size={12} />}
              onClick={() =>
                onChangeLayout({
                  kind: "pair",
                  desktopId: "",
                  mobileId: "",
                  arrangement: "overlap",
                })
              }
            >
              {LAYOUT_LABELS.pair}
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Icon icon={Layers} size={12} />}
              onClick={() =>
                onChangeLayout({
                  kind: "trio",
                  desktopId: "",
                  mobileId: "",
                })
              }
            >
              {LAYOUT_LABELS.trio}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              icon={<Icon icon={LayoutGrid} size={12} />}
              onClick={() =>
                onChangeLayout({
                  kind: "rows",
                  assetIds: [],
                  rows: 2,
                  device: "browser",
                  tilt: 20,
                  speed: 0.5,
                })
              }
            >
              {LAYOUT_LABELS.rows}
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Icon icon={Columns} size={12} />}
              onClick={() =>
                onChangeLayout({
                  kind: "columns",
                  assetIds: [],
                  columns: 3,
                  tilt: 15,
                  speed: 0.5,
                })
              }
            >
              {LAYOUT_LABELS.columns}
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Icon icon={LayoutGrid} size={12} />}
              onClick={() =>
                onChangeLayout({
                  kind: "wall",
                  assetIds: [],
                  columns: 4,
                  speed: 0.5,
                })
              }
            >
              {LAYOUT_LABELS.wall}
            </ContextMenuItem>
            <ContextMenuItem
              icon={<Icon icon={Layers} size={12} />}
              onClick={() =>
                onChangeLayout({
                  kind: "stack",
                  assetIds: [],
                  device: "browser",
                  spread: 0.5,
                })
              }
            >
              {LAYOUT_LABELS.stack}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem
          disabled={!isPlayheadInShot}
          icon={<Icon icon={Scissors} size={13} />}
          onClick={() => onSplit(splitLocalT)}
        >
          Split here
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
