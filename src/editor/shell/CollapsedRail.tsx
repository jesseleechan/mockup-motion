import React from "react";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { Icon, Tooltip } from "../../ui";
import { useUIStore } from "../../state/ui-store";
import { COLLAPSED_RAIL_WIDTH, type SidePanel } from "./panel-layout";
import { Cluster } from "./Cluster";

const COPY: Record<SidePanel, { label: string; shortcut: string }> = {
  library: { label: "Show library", shortcut: "[" },
  inspector: { label: "Show inspector", shortcut: "]" },
};

/**
 * What a collapsed side panel leaves: a slim floating rail the panel's height, with the button
 * that opens the panel again at the top.
 */
export const CollapsedRail: React.FC<{ panel: SidePanel }> = ({ panel }) => {
  const togglePanel = useUIStore((s) => s.togglePanel);
  const { label, shortcut } = COPY[panel];
  return (
    <div data-rail={panel} style={{ width: COLLAPSED_RAIL_WIDTH }} className="shrink-0 z-20">
      <Cluster className="h-full flex-col">
        <Tooltip content={label} shortcut={shortcut} side={panel === "library" ? "right" : "left"}>
          <button
            type="button"
            onClick={() => togglePanel(panel)}
            aria-label={label}
            className="w-9 h-9 flex items-center justify-center rounded-[10px] text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-field)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <Icon icon={panel === "library" ? PanelLeftOpen : PanelRightOpen} size={16} />
          </button>
        </Tooltip>
      </Cluster>
    </div>
  );
};
