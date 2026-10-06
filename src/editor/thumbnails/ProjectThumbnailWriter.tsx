import React, { useEffect, useRef, useState } from "react";
import type { ProjectDoc } from "../../doc/types";
import { useEditorStore } from "../../state/store";
import { useThumbnailRenderer } from "./context";
import { writeProjectThumbnail } from "./project-thumbnail";
import { createProjectThumbnailScheduler } from "./project-thumbnail-scheduler";
import { ThumbnailCancelledError, type ThumbnailRenderer } from "./ThumbnailRenderer";

/**
 * Keeps the stored thumbnail of the open project current (see the scheduler for timing).
 * The document the editor starts with is skipped until it changes, so a pristine,
 * never-saved project leaves no orphan thumbnail.
 */
export const ProjectThumbnailWriter: React.FC = () => {
  const renderer = useThumbnailRenderer();
  const doc = useEditorStore((s) => s.doc);
  const [initialDoc] = useState(doc);
  const scheduler = useRef<ReturnType<typeof createProjectThumbnailScheduler> | null>(null);

  useEffect(() => {
    if (!renderer) return;
    const next = createProjectThumbnailScheduler((target) => storeThumbnail(renderer, target));
    scheduler.current = next;
    return () => {
      next.dispose();
      scheduler.current = null;
    };
  }, [renderer]);

  useEffect(() => {
    if (doc !== initialDoc) scheduler.current?.update(doc);
  }, [doc, initialDoc]);

  return null;
};

function storeThumbnail(renderer: ThumbnailRenderer, doc: ProjectDoc): void {
  writeProjectThumbnail(renderer, doc).catch((err: unknown) => {
    // Disposal (the editor closing) cancels pending renders; nothing to store then.
    if (err instanceof ThumbnailCancelledError) return;
    console.error(`[Thumbnail] Failed to store the thumbnail of project ${doc.id}`, err);
  });
}
