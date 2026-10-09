import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { columnsGeometry } from "./columns";
import { lanesAssetIds, lanesDuration, resolveLanes } from "./lanes";
import { marqueeVelocity } from "./marquee";
import { type LayoutNode, screenAspectFor } from "./types";

const ENTRANCE_DURATION = 0.8;

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
  if (layout.travel !== "period") return layout.assetIds;
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
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  const { assetIds, device = "browser", tilt = 12, speed = 0.25, travel = "steps" } = layout;
  const W = aspectRatioValue(aspect);
  const { numRows, itemW, itemH, stepX, stepY } = rowsGeometry(layout, aspect);

  // Frames: rows are lanes moving sideways, shared with Mobile Frames' columns (lanes.ts).
  if (travel === "period") {
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
      entrance,
    });
  }

  // Angles in radians
  const rx = (tilt * 0.6 * Math.PI) / 180;
  const rz = (-tilt * Math.PI) / 180;

  const distinctAssets = assetIds.length > 0 ? assetIds : [assets[0]?.id ?? "empty"];
  const N = distinctAssets.length;
  const period = N * stepX;

  // Quality-bar §2.5: at most 0.12 frame widths per second, whatever N is.
  const velocity = marqueeVelocity(speed, W, stepX, shotDuration);

  // Diagonal span with margin to guarantee full bleed coverage under tilt
  const diag = Math.sqrt(W * W + 1.0);
  const visibleSpan = diag * 2.0;

  // Ring size: multiple of N * stepX (period) that comfortably covers visibleSpan
  const cycles = Math.max(2, Math.ceil(visibleSpan / period) + 1);
  const totalCount = cycles * N;
  const ringSpan = totalCount * stepX;

  const nodes: LayoutNode[] = [];

  for (let r = 0; r < numRows; r++) {
    const dir = r % 2 === 0 ? -1 : 1;
    // Offset by half a period for adjacent rows
    const rowOffset = (r % 2) * (period / 2);
    const baseY = (r - (numRows - 1) / 2) * stepY;
    const shift = dir * velocity * shotT + rowOffset;

    for (let j = 0; j < totalCount; j++) {
      const assetIdx = j % N;
      const assetId = distinctAssets[assetIdx];
      const asset = assets.find((a) => a.id === assetId);
      const scrAspect = screenAspectFor(device, asset);

      // Ring positioning: modulo ringSpan, centered
      const rawX = j * stepX + shift;
      const modX = ((rawX % ringSpan) + ringSpan) % ringSpan;
      const posX = modX - ringSpan / 2;

      // Rotate point (posX, baseY, 0) about (0,0,0) by rz around Z, then rx around X
      const x1 = posX * Math.cos(rz) - baseY * Math.sin(rz);
      const y1 = posX * Math.sin(rz) + baseY * Math.cos(rz);
      const z1 = 0;

      const x2 = x1;
      const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
      const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);

      // Entrance calculation
      let opacity = 1.0;
      let entranceScale = 1.0;
      if (entrance !== "none") {
        const p = Math.max(0, Math.min(1, shotT / ENTRANCE_DURATION));
        const e = ease("expoOut", p);
        opacity = e;
        entranceScale = 0.97 + 0.03 * e;
      }

      nodes.push({
        id: `row${r}:item${j}`,
        device,
        assetId: assetId === "empty" ? null : assetId,
        width: itemW,
        height: itemH,
        screenAspect: scrAspect,
        transform: {
          x: x2,
          y: y2,
          z: z2,
          rx,
          ry: 0,
          rz,
          scale: entranceScale,
        },
        opacity,
        scroll: 0,
        depthOrder: r * totalCount + j,
      });
    }
  }

  return nodes;
}
