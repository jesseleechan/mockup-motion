import type { ProjectDoc } from "../doc/types";
import { useEditorStore } from "../state/store";
import { useUIStore } from "../state/ui-store";

/** A project with nothing in it yet: the editor opens the gallery over it (polish item 1). */
export function isEmptyProject(doc: ProjectDoc): boolean {
  return doc.assets.length === 0 && !doc.templateId;
}

/**
 * The gallery the editor opened on start steps aside once the project has content or another
 * project is opened: demo content, a template, an upload or a project from Projects.
 */
export function firstRunGalleryDone(prev: ProjectDoc, next: ProjectDoc): boolean {
  return next.id !== prev.id || !isEmptyProject(next);
}

/** Opens the gallery when the editor starts on an empty project. Returns the unsubscribe. */
export function startFirstRunGallery(): () => void {
  const ui = useUIStore.getState();
  if (isEmptyProject(useEditorStore.getState().doc)) ui.openFirstRunGallery();
  return useEditorStore.subscribe((state, prev) => {
    const { firstRunGallery, closeTemplateGallery } = useUIStore.getState();
    if (firstRunGallery && firstRunGalleryDone(prev.doc, state.doc)) closeTemplateGallery();
  });
}
