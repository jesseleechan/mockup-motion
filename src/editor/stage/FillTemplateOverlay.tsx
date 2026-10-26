import React from "react";
import { Button, Icon } from "../../ui";
import { Sparkles, UploadCloud } from "lucide-react";

interface FillTemplateOverlayProps {
  /** What the template still needs, as its gallery card says it (`templateNeeds`). */
  needs: string;
  onChooseScreenshots: () => void;
  onUseDemoContent: () => void;
}

/**
 * Shown while the applied template has empty required slots (F06). Non-blocking: only the card
 * takes pointer events, so the stage and its drop targets stay usable around it.
 */
export const FillTemplateOverlay: React.FC<FillTemplateOverlayProps> = ({
  needs,
  onChooseScreenshots,
  onUseDemoContent,
}) => (
  <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
    <section
      data-testid="fill-template-overlay"
      aria-label="Fill this template"
      // The floating pill of the "Use my screenshots" banner (R2), which can follow it.
      className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-[14px] bg-[var(--color-panel)] shadow-lift pl-4 pr-1.5 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <p className="text-[12.5px] font-medium text-[var(--color-text)]">{needs}</p>
      <div className="flex items-center gap-1">
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
