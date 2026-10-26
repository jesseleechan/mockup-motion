import React, { useId, useState } from "react";
import clsx from "clsx";
import { ChevronRight, RotateCcw } from "lucide-react";
import { Icon } from "./Icon";

export interface SectionProps {
  title: string;
  /** A short note on the right of the heading, e.g. "All layouts". */
  note?: React.ReactNode;
  defaultOpen?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * A group of controls under Layout Stage's heading: uppercase 10.5 px at 0.08 em, with an
 * optional note on the right. Layout Stage sets headings in ink-3 (about 2.5:1 on the light
 * panel); they use text-2 here for 4.5:1 (docs/restyle-plan/README.md, Contrast).
 */
export const Section: React.FC<SectionProps> = ({
  title,
  note,
  defaultOpen = true,
  onReset,
  children,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={clsx("flex flex-col gap-[9px] px-1.5 pt-2.5 pb-3", className)}>
      <div className="flex items-center justify-between gap-2 min-h-5 select-none">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            "flex items-center gap-1 -ml-0.5 pl-0.5 pr-1 rounded-[4px] cursor-pointer",
            "text-[10.5px] leading-[1.2] font-semibold uppercase tracking-[0.08em] text-text-2 hover:text-text transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <Icon
            icon={ChevronRight}
            size={11}
            strokeWidth={2}
            className={clsx("transition-transform duration-180", isOpen && "rotate-90")}
          />
          <span>{title}</span>
        </button>

        {(note !== undefined || onReset) && (
          <div className="flex items-center gap-1 min-w-0">
            {note !== undefined && (
              <span className="text-[11px] text-right text-text-2">{note}</span>
            )}
            {onReset && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
                title="Reset section parameters"
                className="p-1 rounded-[6px] text-text-2 hover:text-text hover:bg-field transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Icon icon={RotateCcw} size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Always rendered, so aria-controls names an element; closed, it is hidden and empty. */}
      <div id={contentId} hidden={!isOpen} className="flex flex-col gap-2.5">
        {isOpen && children}
      </div>
    </div>
  );
};
