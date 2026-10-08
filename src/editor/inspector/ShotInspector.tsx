import React from "react";
import { useEditorStore } from "../../state/store";
import { useUIStore } from "../../state/ui-store";
import { Button, Icon } from "../../ui";
import { Copy, Trash2 } from "lucide-react";
import { LayoutSection } from "./shot/LayoutSection";
import { AssetsSection } from "./shot/AssetsSection";
import { CameraSection } from "./shot/CameraSection";
import { EntranceSection } from "./shot/EntranceSection";
import { TransitionSection } from "./shot/TransitionSection";
import { ScrollSection } from "./shot/ScrollSection";
import { CursorSection } from "./shot/CursorSection";
import { TextLayersSection } from "./shot/TextLayersSection";

interface ShotInspectorProps {
  shotId: string;
}

export const ShotInspector: React.FC<ShotInspectorProps> = ({ shotId }) => {
  const doc = useEditorStore((s) => s.doc);
  const apply = useEditorStore((s) => s.apply);
  const setSelection = useUIStore((s) => s.setSelection);

  const shot = doc.shots.find((s) => s.id === shotId);
  if (!shot) {
    return (
      <div className="p-4 text-xs text-[var(--color-text-3)] text-center">
        Selected shot not found.
      </div>
    );
  }

  const handleDuplicateShot = () => {
    const copy = {
      ...structuredClone(shot),
      id: crypto.randomUUID(),
    };
    apply(
      (draft) => {
        const idx = draft.shots.findIndex((s) => s.id === shotId);
        draft.shots.splice(idx + 1, 0, copy);
      },
      { label: "Duplicate shot" },
    );
    setSelection({ kind: "shot", id: copy.id });
  };

  const handleDeleteShot = () => {
    if (doc.shots.length <= 1) {
      alert("A project must have at least one shot.");
      return;
    }
    apply(
      (draft) => {
        draft.shots = draft.shots.filter((s) => s.id !== shotId);
      },
      { label: "Delete shot" },
    );
    setSelection({ kind: "video" });
  };

  return (
    <div className="space-y-4">
      <LayoutSection shot={shot} assets={doc.assets} />
      <AssetsSection shot={shot} assets={doc.assets} />
      {shot.layout.kind !== "title" && <CameraSection shot={shot} />}
      <EntranceSection shot={shot} aspect={doc.aspect} />
      <TransitionSection shot={shot} />
      <ScrollSection shot={shot} assets={doc.assets} />
      <CursorSection shot={shot} />
      <TextLayersSection shot={shot} />

      <div className="pt-2 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={handleDuplicateShot}
          icon={<Icon icon={Copy} size={14} />}
        >
          Duplicate
        </Button>
        {doc.shots.length > 1 && (
          <Button
            size="sm"
            variant="danger"
            onClick={handleDeleteShot}
            icon={<Icon icon={Trash2} size={14} />}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};
