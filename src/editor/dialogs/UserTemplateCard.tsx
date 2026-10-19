import React, { useState } from "react";
import { Icon } from "../../ui";
import type { UserTemplate } from "../../storage/user-templates";
import { Bookmark, Check, Edit2, Trash2 } from "lucide-react";

interface UserTemplateCardProps {
  template: UserTemplate;
  selected: boolean;
  /** The project uses this template. */
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

/** A saved template in the gallery's "Yours" tab. It has no preview video, only its name. */
export const UserTemplateCard: React.FC<UserTemplateCardProps> = ({
  template,
  selected,
  active,
  onSelect,
  onRename,
  onDelete,
}) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);

  const saveName = async () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== template.name) await onRename(trimmed);
    else setName(template.name);
  };

  return (
    <div
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) onSelect();
      }}
      tabIndex={0}
      role="button"
      aria-label={`Select template ${template.name}`}
      data-testid="user-template-card"
      data-template-id={template.id}
      className={`flex flex-col rounded-xl border transition-all text-left overflow-hidden group cursor-pointer ${
        selected
          ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20 bg-[var(--color-raised)]"
          : "border-[var(--color-line)] bg-[var(--color-panel)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-raised)]"
      }`}
    >
      <div className="aspect-video w-full bg-[var(--color-raised)] border-b border-[var(--color-line)] flex items-center justify-center relative">
        <Icon icon={Bookmark} size={28} className="text-[var(--color-text-3)] opacity-60" />
        {active && (
          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-accent)] text-white flex items-center gap-1 shadow-sm">
            <Check size={10} />
            Active
          </span>
        )}
      </div>

      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 mb-1">
          {editing ? (
            <input
              type="text"
              autoFocus
              aria-label="Template name"
              data-rename-input
              value={name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") void saveName();
                if (e.key === "Escape") {
                  setName(template.name);
                  setEditing(false);
                }
              }}
              onBlur={() => void saveName()}
              className="h-6 min-w-0 flex-1 px-1.5 text-xs rounded border border-[var(--color-accent)] bg-[var(--color-panel)] text-[var(--color-text)] outline-none"
            />
          ) : (
            <h4
              data-truncate
              title={template.name}
              className="min-w-0 truncate text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors"
            >
              {template.name}
            </h4>
          )}

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              aria-label={`Rename ${template.name}`}
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                setName(template.name);
                setEditing(true);
              }}
              className="p-1 rounded text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <Icon icon={Edit2} size={12} />
            </button>
            <button
              type="button"
              aria-label={`Delete ${template.name}`}
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete the template "${template.name}"?`)) void onDelete();
              }}
              className="p-1 rounded text-[var(--color-text-3)] hover:text-[var(--color-danger)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <Icon icon={Trash2} size={12} />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[var(--color-text-2)] leading-relaxed line-clamp-2">
          {template.description}
        </p>
      </div>
    </div>
  );
};
