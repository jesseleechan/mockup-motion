import React from "react";
import { Icon } from "../../ui";
import { templateNeeds, validateTemplateRequirements, type Template } from "../../templates";
import type { AssetRef } from "../../doc/types";
import { TEMPLATE_CATEGORY_LABELS } from "../labels";
import { TemplatePreview } from "../library/TemplatePreview";
import { Check } from "lucide-react";

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

/** A built-in template in the gallery: its preview, name, description and what it needs. */
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
      key={template.id}
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
      data-testid="template-card"
      data-template-id={template.id}
      className={`flex flex-col rounded-xl border transition-all text-left overflow-hidden group cursor-pointer ${
        selected
          ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20 bg-[var(--color-raised)]"
          : "border-[var(--color-line)] bg-[var(--color-panel)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-raised)]"
      }`}
    >
      {/* Media Preview Box */}
      <div className="aspect-video w-full bg-[var(--color-raised)] relative overflow-hidden border-b border-[var(--color-line)]">
        <TemplatePreview
          templateId={template.id}
          active={previewing}
          className="block w-full h-full object-cover"
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-black/60 backdrop-blur-md text-white/90 shadow-sm">
            {template.defaultDuration}s
          </span>

          {active && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center gap-1 shadow-sm">
              <Check size={10} />
              Active
            </span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
              {template.name}
            </h4>
            <span
              data-testid="template-category"
              className="text-[10px] font-medium text-[var(--color-text-3)]"
            >
              {TEMPLATE_CATEGORY_LABELS[template.category]}
            </span>
          </div>

          <p className="text-[11px] text-[var(--color-text-2)] leading-relaxed line-clamp-2 mb-3">
            {template.description}
          </p>
        </div>

        {/* What the template needs; accent while the library falls short. */}
        <div className="pt-2 border-t border-[var(--color-line)] flex items-center gap-1.5">
          {validation.valid && (
            <Icon icon={Check} size={11} className="text-[var(--color-text-3)]" />
          )}
          <span
            data-testid="template-needs"
            className={`text-[10px] font-medium ${
              validation.valid ? "text-[var(--color-text-3)]" : "text-[var(--color-accent)]"
            }`}
          >
            {templateNeeds(template)}
          </span>
        </div>
      </div>
    </div>
  );
};
