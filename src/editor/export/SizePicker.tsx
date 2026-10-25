import React from "react";
import { Chip } from "../../ui";
import type { Aspect } from "../../doc/types";
import { sizeChoices } from "./queue";
import { sectionHeading, sectionNote } from "./surfaces";

interface SizePickerProps {
  projectAspect: Aspect;
  selected: readonly Aspect[];
  onChange: (sizes: Aspect[]) => void;
}

/**
 * The sizes to export, one file each, as Layout Stage's chips. The project's aspect is selected
 * when the dialog opens; at least one size stays selected.
 */
export const SizePicker: React.FC<SizePickerProps> = ({ projectAspect, selected, onChange }) => {
  const toggle = (aspect: Aspect) => {
    if (!selected.includes(aspect)) onChange([...selected, aspect]);
    else if (selected.length > 1) onChange(selected.filter((a) => a !== aspect));
  };
  return (
    <section className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex items-baseline gap-2">
        <span className={sectionHeading}>Sizes</span>
        {selected.length > 1 && <span className={sectionNote}>{selected.length} files</span>}
      </span>
      <div role="group" aria-label="Sizes" className="flex shrink-0 gap-1.5">
        {sizeChoices(projectAspect).map((aspect) => (
          <Chip
            key={aspect}
            pressed={selected.includes(aspect)}
            title={aspect === projectAspect ? "The project's aspect" : undefined}
            onClick={() => toggle(aspect)}
            className="tabular-nums"
          >
            {aspect}
          </Chip>
        ))}
      </div>
    </section>
  );
};
