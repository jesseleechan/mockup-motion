import React from "react";
import { isSteppedLayout } from "../../motion";
import { useEditorStore } from "../../state/store";
import { LayoutSection } from "./shot/LayoutSection";
import { AssetsSection } from "./shot/AssetsSection";
import { CameraSection } from "./shot/CameraSection";
import { DurationSection } from "./shot/DurationSection";
import { ScrollSection } from "./shot/ScrollSection";
import { CursorSection } from "./shot/CursorSection";
import { TextLayersSection } from "./shot/TextLayersSection";

interface ShotInspectorProps {
  shotId: string;
}

export const ShotInspector: React.FC<ShotInspectorProps> = ({ shotId }) => {
  const doc = useEditorStore((s) => s.doc);

  const shot = doc.shots.find((s) => s.id === shotId);
  if (!shot) {
    return (
      <div className="p-4 text-xs text-[var(--color-text-3)] text-center">
        Selected shot not found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LayoutSection shot={shot} assets={doc.assets} />
      <AssetsSection shot={shot} assets={doc.assets} />
      {/* A slider's or orbit's camera is still (quality bar §4), so it has no camera controls. */}
      {shot.layout.kind !== "title" && !isSteppedLayout(shot.layout) && (
        <CameraSection shot={shot} />
      )}
      <DurationSection shot={shot} aspect={doc.aspect} />
      <ScrollSection shot={shot} assets={doc.assets} />
      <CursorSection shot={shot} />
      <TextLayersSection shot={shot} />
    </div>
  );
};
