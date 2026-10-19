import type { Aspect, ProjectDoc } from "../doc/types";
import { fitPace } from "../motion";
import { refitFramesLayout } from "../templates";

/**
 * Sets the document's aspect and re-fits every Frames shot to it (Frames plan D13): the lane
 * count and card size of its preset at the new aspect, with its duration set again from its
 * pace (src/motion/pace.ts), so a Calm or Brisk choice survives the change. Other shots are
 * untouched. Call it inside one store `apply`, so a single undo restores the aspect and the
 * layouts together.
 */
export function changeAspect(draft: ProjectDoc, aspect: Aspect): void {
  draft.aspect = aspect;
  for (const shot of draft.shots) {
    const layout = refitFramesLayout(shot.layout, aspect);
    if (layout === shot.layout) continue;
    shot.layout = layout;
    fitPace(shot, aspect, draft.assets);
  }
}
