import React, { useState } from "react";
import { Icon, Tooltip } from "../../ui";
import { useUIStore } from "../../state/ui-store";
import { MediaTab } from "./MediaTab";
import { CaptureHelpModal } from "../dialogs/CaptureHelpModal";
import { SaveTemplateModal } from "../dialogs/SaveTemplateModal";
import { BookmarkPlus, Camera, LayoutTemplate, PanelLeftClose } from "lucide-react";

/**
 * The screenshots of the project. Templates live in the gallery dialog, which the header's
 * Templates button opens: it has room for the previews, the size hint and saved templates.
 */
export const LibraryPanel: React.FC = () => {
  const togglePanel = useUIStore((s) => s.togglePanel);
  const openTemplateGallery = useUIStore((s) => s.openTemplateGallery);

  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);

  return (
    <aside
      data-panel="library"
      className="w-full min-w-0 bg-[var(--color-panel)] border-r border-[var(--color-line)] flex flex-col select-none overflow-hidden"
    >
      {/* Dialogs */}
      <CaptureHelpModal open={captureModalOpen} onOpenChange={setCaptureModalOpen} />
      <SaveTemplateModal open={saveTemplateModalOpen} onOpenChange={setSaveTemplateModalOpen} />

      {/* Header with quick tools and collapse button */}
      <div className="h-10 px-3 border-b border-[var(--color-line)] flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text)]">Library</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openTemplateGallery}
            className="flex items-center gap-1.5 px-2 py-1 mr-1 rounded text-xs text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
          >
            <Icon icon={LayoutTemplate} size={13} className="text-[var(--color-accent)]" />
            <span>Templates</span>
          </button>

          <Tooltip content="Capture website screenshots">
            <button
              type="button"
              onClick={() => setCaptureModalOpen(true)}
              aria-label="Capture website screenshots"
              className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-hover)] rounded transition-colors"
            >
              <Icon icon={Camera} size={14} />
            </button>
          </Tooltip>

          <Tooltip content="Save project as template">
            <button
              type="button"
              onClick={() => setSaveTemplateModalOpen(true)}
              aria-label="Save as template"
              className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-hover)] rounded transition-colors"
            >
              <Icon icon={BookmarkPlus} size={14} />
            </button>
          </Tooltip>

          <Tooltip content="Collapse library ([)">
            <button
              type="button"
              onClick={() => togglePanel("library")}
              aria-label="Collapse library panel"
              className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded transition-colors"
            >
              <Icon icon={PanelLeftClose} size={15} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <MediaTab />
      </div>
    </aside>
  );
};
