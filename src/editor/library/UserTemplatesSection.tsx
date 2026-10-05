import React, { useEffect, useState } from "react";
import { Icon } from "../../ui";
import { useEditorStore } from "../../state/store";
import {
  deleteUserTemplate,
  fillUserTemplateSlots,
  listUserTemplates,
  renameUserTemplate,
  type UserTemplate,
} from "../../storage/user-templates";
import { Edit2, Trash2 } from "lucide-react";

export const UserTemplatesSection: React.FC = () => {
  const doc = useEditorStore((s) => s.doc);
  const applyTemplateResult = useEditorStore((s) => s.applyTemplateResult);

  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const refreshTemplates = async () => {
    const list = await listUserTemplates();
    setTemplates(list);
  };

  useEffect(() => {
    let active = true;
    listUserTemplates().then((list) => {
      if (active) setTemplates(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleApply = (template: UserTemplate) => {
    const res = fillUserTemplateSlots(template, doc.assets);
    applyTemplateResult(res, template.id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this template?")) {
      await deleteUserTemplate(id);
      await refreshTemplates();
    }
  };

  const handleStartRename = (e: React.MouseEvent, t: UserTemplate) => {
    e.stopPropagation();
    setEditingId(t.id);
    setEditName(t.name);
  };

  const handleSaveRename = async (id: string) => {
    if (editName.trim()) {
      await renameUserTemplate(id, editName.trim());
      await refreshTemplates();
    }
    setEditingId(null);
  };

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="pt-3 pb-1 border-t border-[var(--color-line)] mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-[var(--color-text)] uppercase tracking-wider">
          My Templates ({templates.length})
        </span>
      </div>

      <div className="space-y-2">
        {templates.map((template) => (
          <div
            key={template.id}
            onClick={() => handleApply(template)}
            className="p-2.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-hover)] cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              {editingId === template.id ? (
                <input
                  type="text"
                  autoFocus
                  value={editName}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveRename(template.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => handleSaveRename(template.id)}
                  className="h-5 px-1 text-xs rounded border border-[var(--color-accent)] bg-[var(--color-panel)] text-[var(--color-text)] outline-none"
                />
              ) : (
                <span className="text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors truncate">
                  {template.name}
                </span>
              )}

              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  type="button"
                  title="Rename"
                  onClick={(e) => handleStartRename(e, template)}
                  className="p-1 opacity-0 group-hover:opacity-100 text-[var(--color-text-3)] hover:text-[var(--color-text)] transition-opacity"
                >
                  <Icon icon={Edit2} size={11} />
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={(e) => handleDelete(e, template.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 text-[var(--color-text-3)] hover:text-[var(--color-danger)] transition-opacity"
                >
                  <Icon icon={Trash2} size={11} />
                </button>
              </div>
            </div>

            <p className="text-[10px] text-[var(--color-text-3)] line-clamp-1 mb-1.5">
              {template.description}
            </p>

            <div className="flex items-center justify-between text-[10px] text-[var(--color-text-3)]">
              <span>{template.shots.length} shot(s)</span>
              <span className="text-[9px] text-[var(--color-accent)] font-medium">Click to apply</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
