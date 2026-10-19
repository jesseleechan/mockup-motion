import type { ProjectDoc } from "../doc/types";
import { listProjects, loadProject } from "../storage/projects";
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

/** Closes the gallery the editor opened once it is done. Returns the unsubscribe. */
export function watchFirstRunGallery(): () => void {
  return useEditorStore.subscribe((state, prev) => {
    const { firstRunGallery, closeTemplateGallery } = useUIStore.getState();
    if (firstRunGallery && firstRunGalleryDone(prev.doc, state.doc)) closeTemplateGallery();
  });
}

export interface ProjectSource {
  listProjects: () => Promise<{ id: string }[]>;
  loadProject: (id: string) => Promise<ProjectDoc | null>;
}

const savedProjects: ProjectSource = { listProjects, loadProject };

/**
 * What the editor shows on start: the most recent saved project when there is one, otherwise
 * the template gallery over the new, empty project. Does nothing once the user has started
 * (demo content, an upload) while the saved projects were read.
 */
export async function openOnStart(source: ProjectSource = savedProjects): Promise<void> {
  const editor = useEditorStore.getState();
  const startDoc = editor.doc;
  const untouched = () => useEditorStore.getState().doc === startDoc;

  try {
    const [latest] = await source.listProjects();
    if (latest && untouched()) {
      const doc = await source.loadProject(latest.id);
      if (doc && untouched()) editor.loadDoc(doc);
    }
  } catch (err: unknown) {
    // Storage can be unavailable (private windows, blocked site data); start fresh instead.
    console.error("[Start] couldn't read the saved projects:", err);
  }
  // Still on the new project: no saved project, or it couldn't be read.
  if (untouched() && isEmptyProject(startDoc)) useUIStore.getState().openFirstRunGallery();
}
