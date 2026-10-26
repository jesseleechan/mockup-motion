import React from "react";
import { Icon } from "../../ui";
import { templateNeeds, validateTemplateRequirements, type Template } from "../../templates";
import type { AssetRef } from "../../doc/types";
import { TEMPLATE_CATEGORY_LABELS } from "../labels";
import { TemplatePreview } from "../library/TemplatePreview";
import { Check } from "lucide-react";
import { ActiveBadge } from "./ActiveBadge";
import { tileFace, tileRoot } from "./tile";

interface TemplateCardProps {
  template: Template;
  /** The library's screenshots, for what the template still needs. */
  assets: readonly AssetRef[];
  selected: boolean;
  /** The project uses this template. */
  active: boolean;
  /** Plays the preview video instead of the poster. */
  previewing: boolean;
  onSelect: () => void;
  onPreviewChange: (reason: "hover" | "focus", on: boolean) => void;
}

/**
 * A built-in template in the gallery, as one of Layout Stage's tiles: the preview face, and its
 * name, description and what it needs under it.
 */
export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  assets,
  selected,
  active,
  previewing,
  onSelect,
  onPreviewChange,
}) => {
  const validation = validateTemplateRequirements(template, [...assets]);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => onPreviewChange("hover", true)}
      onMouseLeave={() => onPreviewChange("hover", false)}
      onFocus={() => onPreviewChange("focus", true)}
      onBlur={() => onPreviewChange("focus", false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      tabIndex={0}
      role="button"
      aria-label={`Select template ${template.name}`}
      aria-pressed={selected}
      data-testid="template-card"
      data-template-id={template.id}
      className={tileRoot}
    >
      <div className={tileFace(selected)}>
        <TemplatePreview
          templateId={template.id}
          active={previewing}
          className="block w-full h-full object-cover"
        />

        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          {/* Over the preview, so it keeps its own dark glass in both themes. */}
          <span className="px-1.5 py-0.5 rounded-[6px] font-num text-[10.5px] tabular-nums bg-black/60 text-white">
            {template.defaultDuration}s
          </span>
          {active && <ActiveBadge />}
        </div>
      </div>

      <div className="px-0.5 min-w-0">
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <h4 className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--color-text)]">
            {template.name}
          </h4>
          <span
            data-testid="template-category"
            className="shrink-0 text-[11px] font-medium text-[var(--color-text-2)]"
          >
            {TEMPLATE_CATEGORY_LABELS[template.category]}
          </span>
        </div>

        <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--color-text-2)] line-clamp-2">
          {template.description}
        </p>

        {/* What the template needs; accent while the library falls short. */}
        <div
          className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${
            validation.valid ? "text-[var(--color-text-2)]" : "text-[var(--color-accent)]"
          }`}
        >
          {validation.valid && <Icon icon={Check} size={12} />}
          <span data-testid="template-needs">{templateNeeds(template)}</span>
        </div>
      </div>
    </div>
  );
};
