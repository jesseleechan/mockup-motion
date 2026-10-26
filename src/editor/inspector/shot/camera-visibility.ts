import type { Shot } from "../../../doc/types";
import { isSteppedLayout, isStillCamera } from "../../../motion";

/**
 * Whether the Shot inspector offers camera controls. A slider, orbit, Responsive Scroll or Page
 * Columns camera is always still (quality-bar §4). Frames' camera is still too: a Push in would
 * pop at its cut wrap (contracts.md §5), so Frames shows the controls only when a saved
 * project's camera moves, so it can still be turned off.
 */
export function showsCameraControls(shot: Pick<Shot, "layout" | "camera">): boolean {
  const { layout } = shot;
  if (isSteppedLayout(layout) || layout.kind === "responsive" || layout.kind === "pageColumns") {
    return false;
  }
  if (layout.kind === "rows" || layout.kind === "columns") return !isStillCamera(shot.camera);
  return true;
}
