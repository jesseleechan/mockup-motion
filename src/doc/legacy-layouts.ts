import { clampSliderStep } from "../motion/layouts/duration";
import { framesDefaultLoop } from "../motion/pace";
import { framesLayout, mobileFramesLayout } from "../templates/frames-template";
import type { Aspect, CameraMove, Layout, Shot } from "./types";

/**
 * Saved layouts the editor no longer builds (cut on 19 October 2026, docs/cuts-plan/README.md).
 * A saved project keeps every shot: each of these maps to the nearest preset look.
 *
 * | Saved                                  | Becomes                                   |
 * | -------------------------------------- | ----------------------------------------- |
 * | `pair`, `trio`                         | a single browser with the desktop capture |
 * | `stack` (the tilted fan)               | the Desktop Stack deck                    |
 * | `wall`, `rows` without travel "period" | Desktop Frames                            |
 * | `columns` without travel "period"      | Mobile Frames                             |
 */
export type LegacyLook = "single" | "frames" | "deck";

/** The preset look a saved layout maps to, or null when the layout is current. */
export function legacyLook(raw: Record<string, unknown>): LegacyLook | null {
  switch (raw.kind) {
    case "pair":
    case "trio":
      return "single";
    case "stack":
      return "deck";
    case "wall":
      return "frames";
    case "rows":
    case "columns":
      return raw.travel === "period" ? null : "frames";
    default:
      return null;
  }
}

/**
 * The current layout for a saved one that `legacyLook` names. `assetIds` is the saved
 * screenshot list and `desktopId` the saved desktop capture, both already checked.
 */
export function mapLegacyLayout(
  raw: Record<string, unknown>,
  aspect: Aspect,
  assetIds: string[],
  desktopId: string,
): Layout {
  switch (raw.kind) {
    case "pair":
    case "trio":
      return { kind: "single", device: "browser", assetId: desktopId };
    case "stack":
      // Desktop Stack (src/templates/desktop-stack.ts): 2.0 s per screenshot (quality bar §2.2),
      // shorter when that many steps would pass 30 s.
      return {
        kind: "slider",
        assetIds,
        axis: "y",
        shape: "desktop",
        step: clampSliderStep(2, assetIds.length),
        arrangement: "deck",
      };
    case "columns":
      return mobileFramesLayout(aspect, assetIds);
    default:
      return framesLayout(aspect, assetIds);
  }
}

/**
 * The shot fields a preset look sets (the Frames and Stack templates): a still camera and a cut
 * wrap, since both loop natively. Frames lasts at least its 15 s reference
 * loop. A single browser keeps the saved shot's own.
 */
export function applyLegacyLook(shot: Shot, look: LegacyLook, aspect: Aspect): void {
  if (look === "single") return;
  const still: CameraMove = { preset: "static", intensity: 0, easing: "smooth" };
  shot.camera = still;
  shot.transitionIn = { kind: "cut", duration: 0, easing: "quintInOut" };
  if (look === "frames" && (shot.layout.kind === "rows" || shot.layout.kind === "columns")) {
    shot.duration = framesDefaultLoop(shot.layout, aspect);
  }
}
