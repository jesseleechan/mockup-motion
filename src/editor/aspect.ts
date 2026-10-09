import type { Aspect, ProjectDoc } from "../doc/types";
import { minShotDuration } from "../motion";
import { refitFramesLayout } from "../templates";

// A shot lasts 1–30 s (contracts.md, `Shot.duration`).
const MAX_SHOT_DURATION = 30;

/**
 * Sets the document's aspect and re-fits every Frames shot to it (Frames plan D13): the lane
 * count and card size of its preset at the new aspect, with its duration clamped to the new
 * `minShotDuration`. Other shots are untouched. Call it inside one store `apply`, so a single
 * undo restores the aspect and the layouts together.
 */
export function changeAspect(draft: ProjectDoc, aspect: Aspect): void {
  draft.aspect = aspect;
  for (const shot of draft.shots) {
    const layout = refitFramesLayout(shot.layout, aspect);
    if (layout === shot.layout) continue;
    shot.layout = layout;
    shot.duration = Math.min(
      MAX_SHOT_DURATION,
      Math.max(minShotDuration(layout, aspect), shot.duration),
    );
  }
}
