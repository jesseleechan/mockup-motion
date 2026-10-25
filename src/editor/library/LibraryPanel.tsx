import React, { useId, useState } from "react";
import { Button, Icon, IconButton } from "../../ui";
import { useUIStore } from "../../state/ui-store";
import { MediaTab } from "./MediaTab";
import { CaptureHelpModal } from "../dialogs/CaptureHelpModal";
import { SaveTemplateModal } from "../dialogs/SaveTemplateModal";
import { BookmarkPlus, Camera, LayoutTemplate, PanelLeftClose } from "lucide-react";

/**
 * The screenshots of the project. Templates live in the gallery dialog, which the Templates
 * button opens: it has room for the previews, the size hint and saved templates.
 */
export const LibraryPanel: React.FC = () => {
  const togglePanel = useUIStore((s) => s.togglePanel);
  const openTemplateGallery = useUIStore((s) => s.openTemplateGallery);
  const headingId = useId();

  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);

  return (
    <aside
      data-panel="library"
      aria-labelledby={headingId}
      className="w-full min-w-0 bg-[var(--color-panel)] rounded-[18px] shadow-lift flex flex-col select-none overflow-hidden"
    >
      {/* Dialogs */}
      <CaptureHelpModal open={captureModalOpen} onOpenChange={setCaptureModalOpen} />
      <SaveTemplateModal open={saveTemplateModalOpen} onOpenChange={setSaveTemplateModalOpen} />

      {/* The panel's tools, where Layout Stage keeps its tabs: Templates with its label, then
          icon buttons. */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-2 pt-2">
        <Button
          variant="secondary"
          icon={<Icon icon={LayoutTemplate} size={14} />}
          onClick={openTemplateGallery}
        >
          Templates
        </Button>

        <div className="flex items-center gap-0.5">
          <IconButton
            aria-label="Capture website screenshots"
            tooltip="Capture website screenshots"
            icon={<Icon icon={Camera} size={16} />}
            onClick={() => setCaptureModalOpen(true)}
          />
          <IconButton
            aria-label="Save as template"
            tooltip="Save project as template"
            icon={<Icon icon={BookmarkPlus} size={16} />}
            onClick={() => setSaveTemplateModalOpen(true)}
          />
          <IconButton
            aria-label="Collapse library panel"
            tooltip="Collapse library"
            shortcut="["
            icon={<Icon icon={PanelLeftClose} size={16} />}
            onClick={() => togglePanel("library")}
          />
        </div>
      </div>

      <MediaTab headingId={headingId} />
    </aside>
  );
};
