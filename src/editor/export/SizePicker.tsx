import React from "react";
import clsx from "clsx";
import type { Aspect } from "../../doc/types";
import { sizeChoices } from "./queue";

interface SizePickerProps {
  projectAspect: Aspect;
  selected: readonly Aspect[];
  onChange: (sizes: Aspect[]) => void;
}

/**
 * The sizes to export, one file each. The project's aspect is selected when the dialog opens;
 * at least one size stays selected.
 */
export const SizePicker: React.FC<SizePickerProps> = ({ projectAspect, selected, onChange }) => {
  const toggle = (aspect: Aspect) => {
    if (!selected.includes(aspect)) onChange([...selected, aspect]);
    else if (selected.length > 1) onChange(selected.filter((a) => a !== aspect));
  };
  return (
    <section className="flex items-center justify-between gap-3">
      <span className="min-w-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-3)]">
        Sizes
        {selected.length > 1 && (
          <span className="ml-1.5 font-medium normal-case tracking-normal">
            · {selected.length} files
          </span>
        )}
      </span>
      <div role="group" aria-label="Sizes" className="flex shrink-0 gap-1.5">
        {sizeChoices(projectAspect).map((aspect) => {
          const isSelected = selected.includes(aspect);
          return (
            <button
              key={aspect}
              type="button"
              aria-pressed={isSelected}
              title={aspect === projectAspect ? "The project's aspect" : undefined}
              onClick={() => toggle(aspect)}
              className={clsx(
                "h-7 px-2.5 rounded-md border font-num text-[12px] font-medium tabular-nums transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-raised)] text-[var(--color-text)]"
                  : "border-[var(--color-line)] text-[var(--color-text-2)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-text)]",
              )}
            >
              {aspect}
            </button>
          );
        })}
      </div>
    </section>
  );
};
