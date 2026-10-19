import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { lanesAssetIds, resolveLanes } from "./lanes";
import { PHONE_BODY_ASPECT, PHONE_SCREEN_ASPECT } from "../phone-spec";
import type { LayoutNode } from "./types";

type ColumnsLayout = Extract<Layout, { kind: "columns" }>;

/**
 * Card size and pitch of a columns layout at an aspect, shared by the layout and
 * `framesDuration`. Unset fields take the per-column-count phone sizes. A portrait card
 * (`device: "card"`) is `cardWidth / 0.4615` tall, whatever the image's own aspect.
 */
export function columnsGeometry(layout: ColumnsLayout, aspect: Aspect) {
  const { columns = 3, device = "phone", cardWidth, gap } = layout;
  const W = aspectRatioValue(aspect);

  const numCols = Math.max(2, Math.min(5, columns));
  let phoneH: number;
  switch (numCols) {
    case 2:
      phoneH = 0.7;
      break;
    case 3:
      phoneH = 0.58;
      break;
    case 4:
      phoneH = 0.48;
      break;
    case 5:
    default:
      phoneH = 0.4;
      break;
  }
  const itemW = cardWidth ?? phoneH * PHONE_BODY_ASPECT;
  let itemH: number;
  if (device === "card") {
    itemH = itemW / PHONE_SCREEN_ASPECT;
  } else {
    itemH = cardWidth === undefined ? phoneH : itemW / PHONE_BODY_ASPECT;
  }

  const gapX = gap ?? 0.08 * W;
  const stepX = itemW + gapX;
  const gapY = gap ?? 0.12;
  const stepY = itemH + gapY;
  return { numCols, itemW, itemH, stepX, stepY };
}

export function resolveColumnsLayout(
  layout: ColumnsLayout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  const { assetIds, tilt = 0, device = "phone" } = layout;
  const W = aspectRatioValue(aspect);
  const { numCols, itemW, itemH, stepX, stepY } = columnsGeometry(layout, aspect);

  // Frames: columns are lanes moving vertically, shared with Desktop Frames' rows (lanes.ts).
  return resolveLanes({
    axis: "y",
    geometry: { lanes: numCols, along: itemH, across: itemW, pitch: stepY, lanePitch: stepX },
    device,
    // Phones and portrait cards both show the phone screen, whatever the image's aspect:
    // screenAspectFor("card", tallImage) would crop a mobile screenshot to a landscape strip.
    screenAspect: PHONE_SCREEN_ASPECT,
    // Frames shows only the screenshots that fit a 30 s shot (framesAssetIds).
    assetIds: lanesAssetIds(assetIds, stepY),
    assets,
    frameWidth: W,
    tilt,
    shotT,
    shotDuration,
    entrance,
  });
}
