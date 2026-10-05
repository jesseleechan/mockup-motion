import React from "react";
import type { Layout, ProjectDoc } from "../../doc/types";
import { BUILTIN_TEMPLATES } from "../../templates/registry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuTrigger,
  Icon,
} from "../../ui";
import { Copy, Plus, Sparkles, Type } from "lucide-react";

export interface AddShotMenuProps {
  doc: ProjectDoc;
  insertAfterIndex?: number;
  onAddShot: (layout?: Layout, insertAfterIndex?: number) => void;
  onAddFromTemplate: (templateId: string, insertAfterIndex?: number) => void;
}

export const AddShotMenu: React.FC<AddShotMenuProps> = ({
  doc,
  insertAfterIndex,
  onAddShot,
  onAddFromTemplate,
}) => {
  const currentShot =
    insertAfterIndex !== undefined && insertAfterIndex >= 0
      ? doc.shots[insertAfterIndex]
      : doc.shots[doc.shots.length - 1];

  const handleSameLayout = () => {
    const layout = currentShot ? structuredClone(currentShot.layout) : undefined;
    onAddShot(layout, insertAfterIndex);
  };

  const handleTitleCard = () => {
    onAddShot({ kind: "title" }, insertAfterIndex);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Add shot menu"
          className="h-full min-w-[70px] border border-dashed border-[var(--color-line)] hover:border-[var(--color-accent)] rounded-lg flex flex-col items-center justify-center gap-1 text-[var(--color-text-3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]/10 transition-all focus:outline-none shrink-0"
        >
          <Icon icon={Plus} size={15} />
          <span className="text-[10px] font-medium">Add Shot</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-[180px]">
        <DropdownMenuItem icon={<Icon icon={Copy} size={13} />} onClick={handleSameLayout}>
          Same layout
        </DropdownMenuItem>

        <DropdownMenuItem icon={<Icon icon={Type} size={13} />} onClick={handleTitleCard}>
          Title card
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* From template options */}
        <DropdownMenuSub>
          <div className="px-2 py-1 text-[10px] font-semibold text-[var(--color-text-3)] uppercase tracking-wider">
            From Template
          </div>
          {BUILTIN_TEMPLATES.map((tmpl) => (
            <DropdownMenuItem
              key={tmpl.id}
              icon={<Icon icon={Sparkles} size={12} />}
              onClick={() => onAddFromTemplate(tmpl.id, insertAfterIndex)}
            >
              <span className="truncate">{tmpl.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
