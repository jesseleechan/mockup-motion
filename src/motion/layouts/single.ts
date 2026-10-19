import type { Aspect, AssetRef, Layout } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { PHONE_BODY_ASPECT } from "../phone-spec";
import { type LayoutNode, screenAspectFor } from "./types";

export function resolveSingleLayout(
  layout: Extract<Layout, { kind: "single" }>,
  aspect: Aspect,
  assets: AssetRef[],
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
    width = height * PHONE_BODY_ASPECT; // quality-bar §3.3
  } else {
    // browser, card
    const targetWidthFraction = aspect === "16:9" || aspect === "4:3" ? 0.68 : 0.86;
    width = targetWidthFraction * W;
    height = width / screenAspect;

    // Chrome adds height for a browser
    if (device === "browser") {
      height += width * 0.042;
    }

    // Keep safe margin >= 7%
    if (height > 0.84) {
      const scale = 0.84 / height;
      width *= scale;
      height = 0.84;
    }
  }

  const transform = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1.0 };

  return [
    {
      id: "single:0",
      device,
      assetId: assetId || null,
      width,
      height,
      screenAspect,
      transform,
      opacity: 1,
      scroll: 0,
      depthOrder: 0,
    },
  ];
}
