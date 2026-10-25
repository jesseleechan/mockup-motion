import React, { useId, useState } from "react";
import { Button, Dialog, DialogContent, Input } from "../../ui";
import { useEditorStore } from "../../state/store";
import { convertDocToUserTemplate, saveUserTemplate } from "../../storage/user-templates";

interface SaveTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

// Field's label (src/ui/Field.tsx), as a real <label> so it names its text box.
const labelText = "text-[12px] font-medium text-[var(--color-text-2)] select-none";

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  open,
  onOpenChange,
  onSaved,
}) => {
  const doc = useEditorStore((s) => s.doc);
  const [name, setName] = useState(`${doc.name} Template`);
  const [description, setDescription] = useState("Custom user template");
  const [saving, setSaving] = useState(false);
  const nameId = useId();
  const descriptionId = useId();

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
        title="Save as template"
        description="Save your current shots, camera angles, and style as a reusable template for other projects."
        className="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className={labelText}>
              Name
            </label>
            <Input
              id={nameId}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Studio Reel"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={descriptionId} className={labelText}>
              Description
            </label>
            <Input
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 2-shot mobile & desktop walkthrough"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving" : "Save template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
