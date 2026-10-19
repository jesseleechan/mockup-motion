import type { Aspect, AssetRef, Layout } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { columnsGeometry } from "./columns";
import { lanesAssetIds, lanesDuration, resolveLanes } from "./lanes";
import type { LayoutNode } from "./types";

type RowsLayout = Extract<Layout, { kind: "rows" }>;
type ColumnsLayout = Extract<Layout, { kind: "columns" }>;

/** Card size and pitch of a rows layout at an aspect, shared by the layout and `framesDuration`. */
export function rowsGeometry(layout: RowsLayout, aspect: Aspect) {
  const { rows = 2, device = "browser", cardHeight, gap } = layout;
  const W = aspectRatioValue(aspect);

  const numRows = Math.max(1, Math.min(3, rows)) as 1 | 2 | 3;
  let itemH = cardHeight ?? (numRows === 1 ? 0.56 : numRows === 2 ? 0.42 : 0.32);
  const baseAspect = 1.6;
  const itemW = itemH * baseAspect;
  if (device === "browser") {
    itemH += itemW * 0.042; // chrome height
  }

  // Spacing so 3 assets easily span beyond the visible window (no repeats)
  const gapX = gap ?? 0.14 * W;
  const stepX = itemW + gapX;
  const gapY = gap ?? 0.06;
  const stepY = itemH + gapY;
  return { numRows, itemW, itemH, stepX, stepY };
}

/** The card pitch along the lanes of a Frames layout: along a row, or down a column. */
function framesPitch(layout: RowsLayout | ColumnsLayout, aspect: Aspect): number {
  return layout.kind === "rows"
    ? rowsGeometry(layout, aspect).stepX
    : columnsGeometry(layout, aspect).stepY;
}

/**
 * The screenshots a Frames layout (rows or columns with travel "period") shows: the first ones
 * whose period fits a 30 s shot at 0.20 stage units per second (quality-bar §2.2). Desktop
 * Frames shows 10 with the 3-row cards (4:5, 9:16, 1:1) and 8 with the 2-row cards (16:9, 4:3);
 * Mobile Frames 9 at 16:9, 4:3 and 1:1 and 10 at 4:5 and 9:16. Later ones are left out, as a
 * slider leaves out screenshots past 18. Other rows and columns layouts show every screenshot.
 */
export function framesAssetIds(layout: RowsLayout | ColumnsLayout, aspect: Aspect): string[] {
  return lanesAssetIds(layout.assetIds, framesPitch(layout, aspect));
}

/**
 * The shortest shot, rounded up to 0.5 s, in which a Frames layout (rows or columns with travel
 * "period") moves one asset period at no more than 0.20 stage units per second (quality-bar
 * §2.5). Templates and the editor use it as the minimum shot duration. It is at most 30 s,
 * because only `framesAssetIds` count.
 */
export function framesDuration(layout: RowsLayout | ColumnsLayout, aspect: Aspect): number {
  return lanesDuration(framesAssetIds(layout, aspect).length, framesPitch(layout, aspect));
}

export function resolveRowsLayout(
  layout: RowsLayout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
): LayoutNode[] {
  const { assetIds, device = "browser", tilt = 0 } = layout;
  const W = aspectRatioValue(aspect);
  const { numRows, itemW, itemH, stepX, stepY } = rowsGeometry(layout, aspect);

  // Frames: rows are lanes moving sideways, shared with Mobile Frames' columns (lanes.ts).
  return resolveLanes({
    axis: "x",
    geometry: { lanes: numRows, along: itemW, across: itemH, pitch: stepX, lanePitch: stepY },
    device,
    // Frames shows only the screenshots that fit a 30 s shot (framesAssetIds).
    assetIds: lanesAssetIds(assetIds, stepX),
    assets,
    frameWidth: W,
    tilt,
    shotT,
    shotDuration,
  });
}
