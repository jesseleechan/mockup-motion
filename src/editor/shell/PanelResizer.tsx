import React, { useRef } from "react";
import { useUIStore } from "../../state/ui-store";
import {
  PANEL_DEFAULT_WIDTHS,
  PANEL_MIN_WIDTHS,
  WORKSPACE_GAP,
  savePanelWidths,
  type SidePanel,
} from "./panel-layout";

const LABELS: Record<SidePanel, string> = {
  library: "Resize library",
  inspector: "Resize inspector",
};
// One arrow key press; Shift moves further, as on the timeline.
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

interface PanelResizerProps {
  panel: SidePanel;
  /** The width the panel renders at now, which a narrow window can make less than the saved one. */
  width: number;
  /** The widest the panel may be in this window. */
  max: number;
}

function persist() {
  savePanelWidths(localStorage, useUIStore.getState().panelWidths);
}

/**
 * The handle on a side panel's inner edge: drag it, use the arrow keys, or double-click it to
 * reset. It fills the gap between the floating panel and the stage, so it takes no layout space:
 * an invisible hit area that shows a line on hover, while dragging and on keyboard focus.
 */
export const PanelResizer: React.FC<PanelResizerProps> = ({ panel, width, max }) => {
  const setPanelWidth = useUIStore((s) => s.setPanelWidth);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  // The library grows to the right, the inspector to the left.
  const direction = panel === "library" ? 1 : -1;
  const min = PANEL_MIN_WIDTHS[panel];

  const setWidth = (next: number) => setPanelWidth(panel, Math.min(next, max));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setWidth(drag.current.startWidth + (e.clientX - drag.current.startX) * direction);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    persist();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = width - step * direction;
    if (e.key === "ArrowRight") next = width + step * direction;
    if (e.key === "Home") next = min;
    if (e.key === "End") next = max;
    if (next === null) return;
    // Arrow keys would otherwise step the playhead (EditorShell's shortcuts).
    e.preventDefault();
    e.stopPropagation();
    setWidth(next);
    persist();
  };
  const onDoubleClick = () => {
    setWidth(PANEL_DEFAULT_WIDTHS[panel]);
    persist();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={LABELS[panel]}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-testid={`resize-${panel}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      style={
        panel === "library"
          ? { left: "100%", width: WORKSPACE_GAP }
          : { right: "100%", width: WORKSPACE_GAP }
      }
      className="group absolute top-0 bottom-0 z-30 cursor-col-resize outline-none"
    >
      {/* The visible line, in the middle of the gap. */}
      <div className="absolute inset-y-4 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-transparent transition-colors duration-[var(--duration-fast)] group-hover:bg-[var(--color-line-strong)] group-focus-visible:bg-[var(--color-accent)] group-active:bg-[var(--color-accent)]" />
    </div>
  );
};
