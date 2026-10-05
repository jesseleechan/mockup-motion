import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { type LayoutNode, screenAspectFor } from "./types";

const ENTRANCE_DURATION = 0.8;

export function resolveSingleLayout(
  layout: Extract<Layout, { kind: "single" }>,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  _shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
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
