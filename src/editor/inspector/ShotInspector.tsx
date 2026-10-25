import React from "react";
import { useEditorStore } from "../../state/store";
import { LayoutSection } from "./shot/LayoutSection";
import { AssetsSection } from "./shot/AssetsSection";
import { CameraSection } from "./shot/CameraSection";
import { showsCameraControls } from "./shot/camera-visibility";
import { DurationSection } from "./shot/DurationSection";
import { PaceSection } from "./shot/PaceSection";
import { ScrollSection } from "./shot/ScrollSection";
import { ResponsiveScrollSection } from "./shot/ResponsiveScrollSection";

interface ShotInspectorProps {
  shotId: string;
}

// The sections stack on their own padding, as Layout Stage's .group (Section.tsx).
export const ShotInspector: React.FC<ShotInspectorProps> = ({ shotId }) => {
  const doc = useEditorStore((s) => s.doc);

  const shot = doc.shots.find((s) => s.id === shotId);
  if (!shot) {
    return <p className="p-4 text-[12px] text-text-2 text-center">Selected shot not found.</p>;
  }

  return (
    <>
      <LayoutSection shot={shot} assets={doc.assets} />
      <PaceSection shot={shot} aspect={doc.aspect} />
      <AssetsSection shot={shot} assets={doc.assets} />
      {showsCameraControls(shot) && <CameraSection shot={shot} />}
      <DurationSection shot={shot} aspect={doc.aspect} />
      <ScrollSection shot={shot} assets={doc.assets} />
      <ResponsiveScrollSection shot={shot} assets={doc.assets} />
    </>
  );
};
