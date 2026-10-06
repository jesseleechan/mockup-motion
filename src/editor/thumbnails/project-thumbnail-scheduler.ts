import type { ProjectDoc } from "../../doc/types";

/** While editing, a project's stored thumbnail is rewritten at most this often. */
export const PROJECT_THUMBNAIL_INTERVAL_MS = 30_000;

export interface ProjectThumbnailScheduler {
  /** The open document changed. */
  update(doc: ProjectDoc): void;
  dispose(): void;
}

/**
 * Decides when to store a project's thumbnail. The first change to a project writes right
 * away, later changes at most once per `intervalMs` (the latest state wins). Switching to
 * another project writes the previous one's pending state first.
 */
export function createProjectThumbnailScheduler(
  write: (doc: ProjectDoc) => void,
  intervalMs = PROJECT_THUMBNAIL_INTERVAL_MS,
  now: () => number = Date.now,
): ProjectThumbnailScheduler {
  const lastWrite = new Map<string, number>();
  let pending: ProjectDoc | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const target = pending;
    pending = null;
    if (!target) return;
    lastWrite.set(target.id, now());
    write(target);
  };

  return {
    update(doc) {
      if (timer && pending && pending.id !== doc.id) {
        clearTimeout(timer);
        flush();
      }
      pending = doc;
      // A write is already scheduled for this project; it takes the latest state.
      if (timer) return;
      const last = lastWrite.get(doc.id);
      const wait = last === undefined ? 0 : Math.max(0, last + intervalMs - now());
      timer = setTimeout(flush, wait);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
