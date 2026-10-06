import React from "react";
import { Button, Icon } from "../../ui";
import { Sparkles, UploadCloud } from "lucide-react";

interface FillTemplateOverlayProps {
  onChooseScreenshots: () => void;
  onUseDemoContent: () => void;
}

/**
 * Shown while the applied template has empty required slots (F06). Non-blocking: only the card
 * takes pointer events, so the stage and its drop targets stay usable around it.
 */
export const FillTemplateOverlay: React.FC<FillTemplateOverlayProps> = ({
  onChooseScreenshots,
  onUseDemoContent,
}) => (
  <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
    <section
      data-testid="fill-template-overlay"
      aria-label="Fill this template"
      className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <p className="text-xs font-medium text-[var(--color-text)]">
        Add screenshots to fill this template
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onChooseScreenshots}
          icon={<Icon icon={UploadCloud} size={14} />}
        >
          Choose screenshots
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onUseDemoContent}
          icon={<Icon icon={Sparkles} size={14} />}
        >
          Use demo content
        </Button>
      </div>
    </section>
  </div>
);
