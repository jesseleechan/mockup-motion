import type { Aspect, AssetRef, DeviceKind, Layout, Shot } from "../doc/types";
import { aspectRatioValue } from "./camera";
import { ease } from "./easing";

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
    rx: number;
    ry: number;
    rz: number;
    scale: number;
  };
  opacity: number; // 0..1 (entrances)
  scroll: number; // 0..1 of scrollable range (0 when scroll disabled)
  depthOrder: number; // tie-breaker for transparent sorting
}

const ENTRANCE_DURATION = 0.8;

/**
 * Resolves layout nodes for a shot.
/**
 * Computes screen viewport aspect ratio (width / height) for a device and asset per quality-bar §3.1.
 * - Phone: 0.4615 (9:19.5)
 * - Tablet: 0.75 (4:3)
 * - Desktop browser, laptop, card: clamp(imageAspect, 1.25, 2.0) when image is short, else 1.6
 */
export function screenAspectFor(device: DeviceKind, asset?: { width?: number; height?: number } | null): number {
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

/**
 * Resolves layout nodes for a shot.
 * Currently implements kind: "single" adhering to quality-bar §3 and §4.
 * Other layout kinds throw NotImplemented("WP-09").
 */
export function resolveLayout(
  layout: Layout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  _shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  if (layout.kind !== "single") {
    throw new Error('NotImplemented("WP-09")');
  }

  const { device, assetId } = layout;
  const asset = assets.find((a) => a.id === assetId);
  const screenAspect = screenAspectFor(device, asset);

  // Device outer sizing in stage units (H = 1.0)
  const W = aspectRatioValue(aspect);
  let width: number;
  let height: number;

  if (device === "phone") {
    height = 0.74; // 70-78% of frame height (quality-bar §4)
    width = height * 0.488; // body aspect 0.488 (quality-bar §3.3)
  } else if (device === "tablet") {
    height = 0.72;
    width = 0.72 * 0.75;
  } else {
    // browser, laptop, card
    const targetWidthFraction = aspect === "16:9" || aspect === "4:3" ? 0.68 : 0.86;
    width = targetWidthFraction * W;
    height = width / screenAspect;

    // Chrome adds height for browser/laptop
    if (device === "browser" || device === "laptop") {
      height += width * 0.042;
    }

    // Keep safe margin >= 7%
    if (height > 0.84) {
      const scale = 0.84 / height;
      width *= scale;
      height = 0.84;
    }
  }

  // Entrance handling
  let opacity: number;
  const transform = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1.0 };

  const p = Math.max(0, Math.min(1, shotT / ENTRANCE_DURATION));
  const e = ease("expoOut", p);

  switch (entrance) {
    case "rise":
      opacity = e;
      transform.y = -(1 - e) * 0.03;
      break;
    case "scale":
      opacity = e;
      transform.scale = 0.97 + 0.03 * e;
      break;
    case "stagger":
      opacity = e;
      transform.y = -(1 - e) * 0.03;
      transform.scale = 0.97 + 0.03 * e;
      break;
    case "none":
    default:
      opacity = 1.0;
      break;
  }

  return [
    {
      id: "single:0",
      device,
      assetId: assetId || null,
      width,
      height,
      screenAspect,
      transform,
      opacity,
      scroll: 0,
      depthOrder: 0,
    },
  ];
}
