import type { DeviceKind } from "../../doc/types";

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
  opacity: number; // 0..1 (entrances)
  scroll: number; // 0..1 of scrollable range (0 when scroll disabled)
  depthOrder: number; // tie-breaker for transparent sorting
}

/**
 * Computes screen viewport aspect ratio (width / height) for a device and asset per quality-bar §3.1.
 * - Phone: 0.4615 (9:19.5)
 * - Tablet: 0.75 (4:3)
 * - Desktop browser, laptop, card: clamp(imageAspect, 1.25, 2.0) when image is short, else 1.6
 */
export function screenAspectFor(
  device: DeviceKind,
  asset?: { width?: number; height?: number } | null,
): number {
  if (device === "phone") {
    return 0.4615;
  }
  if (device === "tablet") {
    return 0.75;
  }
  if (asset?.width && asset?.height && asset.height > 0) {
    const imgAspect = asset.width / asset.height;
    if (imgAspect >= 1.25) {
      return Math.max(1.25, Math.min(2.0, imgAspect));
    }
  }
  return 1.6;
}
