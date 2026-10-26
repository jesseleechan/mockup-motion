import type { DeviceKind } from "../../doc/types";
import { PHONE_SCREEN_ASPECT } from "../phone-spec";

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
   * A card's corner radius: the landscape (desktop) or portrait (mobile) card's, whatever its
   * screen aspect (quality-bar §3.4). Page Columns sets it: a desktop page in a tall column keeps
   * the desktop radius. Unset follows the screen aspect.
   */
  cardShape?: "desktop" | "mobile";
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
