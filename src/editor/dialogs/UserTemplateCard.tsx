import React, { useState } from "react";
import { Icon, IconButton, Input } from "../../ui";
import type { UserTemplate } from "../../storage/user-templates";
import { Bookmark, Edit2, Trash2 } from "lucide-react";
import { ActiveBadge } from "./ActiveBadge";
import { tileFace, tileRoot } from "./tile";

interface UserTemplateCardProps {
  template: UserTemplate;
  selected: boolean;
  /** The project uses this template. */
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

/**
 * A saved template in the gallery's "Yours" tab, as a tile like the built-in ones. It has no
 * preview video: its face shows a bookmark.
 */
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
      aria-pressed={selected}
      data-testid="user-template-card"
      data-template-id={template.id}
      className={tileRoot}
    >
      <div className={tileFace(selected, "grid place-items-center")}>
        <Icon icon={Bookmark} size={26} className="text-[var(--color-text-2)]" />
        {active && (
          <span className="absolute top-2 right-2">
            <ActiveBadge />
          </span>
        )}
      </div>

      <div className="px-0.5 min-w-0">
        <div className="flex items-center justify-between gap-2 min-h-7">
          {editing ? (
            <Input
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
              className="h-7! text-[12.5px]!"
            />
          ) : (
            <h4
              data-truncate
              title={template.name}
              className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--color-text)]"
            >
              {template.name}
            </h4>
          )}

          <div className="flex items-center gap-0.5 shrink-0">
            <IconButton
              size="xs"
              aria-label={`Rename ${template.name}`}
              title="Rename"
              icon={<Icon icon={Edit2} size={13} />}
              onClick={(e) => {
                e.stopPropagation();
                setName(template.name);
                setEditing(true);
              }}
            />
            <IconButton
              size="xs"
              aria-label={`Delete ${template.name}`}
              title="Delete"
              icon={<Icon icon={Trash2} size={13} />}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete the template "${template.name}"?`)) void onDelete();
              }}
              className="hover:text-danger!"
            />
          </div>
        </div>

        <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--color-text-2)] line-clamp-2">
          {template.description}
        </p>
      </div>
    </div>
  );
};
