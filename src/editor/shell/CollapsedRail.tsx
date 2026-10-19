import React from "react";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { Icon, Tooltip } from "../../ui";
import { useUIStore } from "../../state/ui-store";
import { COLLAPSED_RAIL_WIDTH, type SidePanel } from "./panel-layout";

const COPY: Record<SidePanel, { label: string; shortcut: string }> = {
  library: { label: "Show library", shortcut: "[" },
  inspector: { label: "Show inspector", shortcut: "]" },
};

/** What a collapsed side panel leaves: a slim rail with the button that opens it again. */
export const CollapsedRail: React.FC<{ panel: SidePanel }> = ({ panel }) => {
  const togglePanel = useUIStore((s) => s.togglePanel);
  const { label, shortcut } = COPY[panel];
  return (
    <div
      data-rail={panel}
      style={{ width: COLLAPSED_RAIL_WIDTH }}
      className={`shrink-0 bg-[var(--color-panel)] border-[var(--color-line)] flex flex-col items-center pt-[7px] z-20 ${
        panel === "library" ? "border-r" : "border-l"
      }`}
    >
      <Tooltip content={label} shortcut={shortcut} side={panel === "library" ? "right" : "left"}>
        <button
          type="button"
          onClick={() => togglePanel(panel)}
          aria-label={label}
          className="p-1.5 text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded transition-colors"
        >
          <Icon icon={panel === "library" ? PanelLeftOpen : PanelRightOpen} size={15} />
        </button>
      </Tooltip>
    </div>
  );
};
