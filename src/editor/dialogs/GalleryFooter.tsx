import React from "react";
import { Button, Icon } from "../../ui";
import type { Template } from "../../templates";
import type { UserTemplate } from "../../storage/user-templates";
import { UploadCloud, Wand2 } from "lucide-react";

interface GalleryFooterProps {
  /** The selected built-in template, if any. */
  template?: Template;
  /** The selected saved template, if any. */
  userTemplate?: UserTemplate;
  /** Why the selected template can't fill from the library yet, e.g. "Needs 3+ desktop screenshots". */
  reason?: string;
  /** The selected preset's other size, when that one matches the screenshots. */
  fitting?: Template;
  /** The demo content can fill what the selected template is missing. */
  canUseDemo: boolean;
  onSwitch: (template: Template) => void;
  onTryDemo: (template: Template) => void;
  onChooseScreenshots: (template: Template) => void;
  onApply: () => void;
}

/**
 * The gallery's footer: the selection and what it needs on the left, the ways in on the right.
 * The close button and Escape cancel, so the footer has room for them.
 */
export const GalleryFooter: React.FC<GalleryFooterProps> = ({
  template,
  userTemplate,
  reason,
  fitting,
  canUseDemo,
  onSwitch,
  onTryDemo,
  onChooseScreenshots,
  onApply,
}) => {
  const selectedName = userTemplate?.name ?? template?.name;
  return (
    <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-4 border-t border-[var(--color-line)]">
      <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
        {selectedName && (
          <span className="font-medium text-[var(--color-text)]">Selected: {selectedName}</span>
        )}
        {template &&
          (fitting ? (
            <span
              data-testid="template-size-hint"
              className="text-[var(--color-text-2)] flex items-center gap-1.5"
            >
              {fitting.name} fits your screenshots.
              <button
                type="button"
                onClick={() => onSwitch(fitting)}
                aria-label={`Switch to ${fitting.name}`}
                className="font-semibold text-[var(--color-accent)] rounded-[4px] cursor-pointer hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Switch
              </button>
            </span>
          ) : (
            reason && <span className="font-medium text-[var(--color-accent)]">({reason})</span>
          ))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {template && canUseDemo && (
          <>
            <Button
              variant="secondary"
              onClick={() => onTryDemo(template)}
              icon={<Icon icon={Wand2} size={14} />}
            >
              Try with demo content
            </Button>
            <Button
              variant="secondary"
              onClick={() => onChooseScreenshots(template)}
              icon={<Icon icon={UploadCloud} size={14} />}
            >
              Choose screenshots
            </Button>
          </>
        )}
        <Button variant="primary" disabled={!template && !userTemplate} onClick={onApply}>
          Apply template
        </Button>
      </div>
    </div>
  );
};
