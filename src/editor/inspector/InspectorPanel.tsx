import React from "react";
import { useUIStore } from "../../state/ui-store";
import { useEditorStore } from "../../state/store";
import { VideoInspector } from "./VideoInspector";
import { ShotInspector } from "./ShotInspector";
import { TextInspector } from "./TextInspector";
import { Icon, Tooltip } from "../../ui";
import { PanelRightClose } from "lucide-react";

export const InspectorPanel: React.FC = () => {
  const selection = useUIStore((s) => s.selection);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const setSelection = useUIStore((s) => s.setSelection);
  const doc = useEditorStore((s) => s.doc);

  // Derive header title
  let title = "Video Settings";
  if (selection.kind === "shot") {
    const idx = doc.shots.findIndex((s) => s.id === selection.id);
    title = idx !== -1 ? `Shot ${idx + 1}` : "Shot Settings";
  } else if (selection.kind === "text") {
    title = "Text Layer";
  }

  return (
    <aside className="w-[304px] bg-[var(--color-panel)] border-l border-[var(--color-line)] flex flex-col shrink-0 select-none z-20 overflow-hidden">
      {/* Header */}
      <div className="h-10 px-3 border-b border-[var(--color-line)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {selection.kind !== "video" && (
            <button
              type="button"
              onClick={() => setSelection({ kind: "video" })}
              className="text-[11px] font-medium text-[var(--color-text-3)] hover:text-[var(--color-accent)] transition-colors"
            >
              Video &gt;
            </button>
          )}
          <span className="text-xs font-semibold text-[var(--color-text)] truncate">{title}</span>
        </div>

        <Tooltip content="Collapse inspector (])">
          <button
            type="button"
            onClick={() => togglePanel("inspector")}
            aria-label="Collapse inspector panel"
            className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded transition-colors"
          >
            <Icon icon={PanelRightClose} size={15} />
          </button>
        </Tooltip>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 pr-2 space-y-4">
        {selection.kind === "video" && <VideoInspector />}
        {selection.kind === "shot" && <ShotInspector shotId={selection.id} />}
        {selection.kind === "text" && (
          <TextInspector shotId={selection.shotId} textId={selection.id} />
        )}
      </div>
    </aside>
  );
};
