import React, { useState } from "react";
import { Button, Dialog, DialogContent, Field } from "../../ui";
import { useEditorStore } from "../../state/store";
import { convertDocToUserTemplate, saveUserTemplate } from "../../storage/user-templates";

interface SaveTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  open,
  onOpenChange,
  onSaved,
}) => {
  const doc = useEditorStore((s) => s.doc);
  const [name, setName] = useState(`${doc.name} Template`);
  const [description, setDescription] = useState("Custom user template");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const template = convertDocToUserTemplate(doc, name.trim(), description.trim());
      await saveUserTemplate(template);
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Save as Template"
        description="Save your current shots, camera angles, and style as a reusable template for other projects."
        className="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Template Name" htmlFor="tmpl-name">
            <input
              id="tmpl-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-2.5 rounded border border-[var(--color-line)] bg-[var(--color-raised)] text-xs text-[var(--color-text)] focus:border-[var(--color-accent)] outline-none"
              placeholder="e.g. My Studio Reel"
            />
          </Field>

          <Field label="Description (optional)" htmlFor="tmpl-desc">
            <input
              id="tmpl-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-8 px-2.5 rounded border border-[var(--color-line)] bg-[var(--color-raised)] text-xs text-[var(--color-text)] focus:border-[var(--color-accent)] outline-none"
              placeholder="e.g. 2-shot mobile & desktop walkthrough"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
