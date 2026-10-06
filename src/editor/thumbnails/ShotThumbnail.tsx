import React, { useMemo } from "react";
import clsx from "clsx";
import type { Shot } from "../../doc/types";
import { useEditorStore } from "../../state/store";
import { shotThumbnailDoc } from "./docs";
import { useThumbnail } from "./useThumbnail";

/** The shot rendered at its local midpoint; an empty frame until the first render lands. */
export const ShotThumbnail: React.FC<{ shot: Shot; className?: string }> = ({
  shot,
  className,
}) => {
  const style = useEditorStore((s) => s.doc.style);
  const assets = useEditorStore((s) => s.doc.assets);
  const aspect = useEditorStore((s) => s.doc.aspect);
  const exportSettings = useEditorStore((s) => s.doc.export);
  const doc = useMemo(
    () => shotThumbnailDoc({ style, assets, aspect, export: exportSettings }, shot),
    [style, assets, aspect, exportSettings, shot],
  );
  const url = useThumbnail(doc, shot.duration / 2, aspect, shot.id);

  return (
    // The image is absolutely positioned so its intrinsic height never sizes the card.
    <div
      className={clsx("relative", className)}
      style={{ aspectRatio: aspect.replace(":", " / ") }}
      data-testid="shot-thumbnail"
    >
      {url && (
        <img
          src={url}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
};
