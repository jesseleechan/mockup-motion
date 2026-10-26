import type { DeviceKind } from "../../doc/types";
import { PHONE_SCREEN_ASPECT } from "../phone-spec";

/**
 * One screenshot on a screen that draws more than one (contracts.md §4): Site Tour's leaving
 * and arriving pages. Horizontal positions are in screen widths, from the screen's left edge.
 * The screenshot is fit to the screen's width as on any screen (quality bar §3.1), shifted by
 * `offset`, and drawn only where it overlaps `clip` and the screen.
 */
export interface ScreenPane {
  assetId: string | null; // null draws the empty-state fill
  /** Where the screenshot's left edge sits: 0 fills the screen, 1 is just past its right edge. */
  offset: number;
  /** The band of the screen the pane may draw on, [left, right]; [0, 1] is the whole screen. */
  clip: readonly [number, number];
  scroll: number; // 0..1 of the screenshot's scrollable range
}

export interface LayoutNode {
  id: string; // stable across frames, e.g. "row1:col3" or "single:0"
  device: DeviceKind;
  assetId: string | null; // null renders an empty-state screen
  width: number; // device outer size in stage units
  height: number;
  screenAspect: number; // width/height of visible screen viewport
  transform: {
    x: number;
    y: number;
    z: number;
    rx: number; // in radians
    ry: number; // in radians
    rz: number; // in radians
    scale: number;
  };
  opacity: number; // 0..1 (slider neighbours, a deck's entering card)
  scroll: number; // 0..1 of scrollable range (0 when scroll disabled)
  depthOrder: number; // tie-breaker for transparent sorting
  /**
   * A screen that draws more than one screenshot draws these panes, in order (later ones over
   * earlier ones), in place of `assetId` and `scroll`; `assetId` is then the screenshot that
   * covers most of the screen, for picking and the editor. Every frame lists every screenshot
   * the screen shows during the shot, in the same order, so the engine loads, sizes and uploads
   * them once; a pane outside the screen or its clip draws nothing.
   */
  panes?: ScreenPane[];
}

/**
 * Computes screen viewport aspect ratio (width / height) for a device and asset per quality-bar §3.1.
 * - Phone: 0.4615 (9:19.5)
 * - Desktop browser, card: clamp(imageAspect, 1.25, 2.0) when image is short, else 1.6
 */
export function screenAspectFor(
  device: DeviceKind,
  asset?: { width?: number; height?: number } | null,
): number {
  if (device === "phone") {
    return PHONE_SCREEN_ASPECT;
  }
  if (asset?.width && asset?.height && asset.height > 0) {
    const imgAspect = asset.width / asset.height;
    if (imgAspect >= 1.25) {
      return Math.max(1.25, Math.min(2.0, imgAspect));
    }
  }
  return 1.6;
}
