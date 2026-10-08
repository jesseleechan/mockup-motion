import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { MAX_SHOT_DURATION } from "./limits";
import { FRAMES_MAX_FRAME_HEIGHTS_PER_SECOND, marqueeVelocity } from "./marquee";
import { type LayoutNode, screenAspectFor } from "./types";

const ENTRANCE_DURATION = 0.8;

type RowsLayout = Extract<Layout, { kind: "rows" }>;

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

/**
 * The screenshots a Frames layout (rows with travel "period") shows: the first ones whose
 * period fits a 30 s shot at 0.20 frame heights per second (quality-bar §2.2). That is 10 with
 * the 3-row cards (4:5, 9:16, 1:1) and 8 with the 2-row cards (16:9, 4:3). Later ones are left
 * out, as a slider leaves out screenshots past 18. Other rows layouts show every screenshot.
 */
export function framesAssetIds(layout: RowsLayout, aspect: Aspect): string[] {
  if (layout.travel !== "period") return layout.assetIds;
  const { stepX } = rowsGeometry(layout, aspect);
  // The epsilon keeps an exact fit from rounding down.
  const fit = Math.floor((MAX_SHOT_DURATION * FRAMES_MAX_FRAME_HEIGHTS_PER_SECOND) / stepX + 1e-9);
  return layout.assetIds.slice(0, Math.max(1, fit));
}

/**
 * The shortest shot, rounded up to 0.5 s, in which a Frames layout (rows with travel
 * "period") moves one asset period at no more than 0.20 frame heights per second
 * (quality-bar §2.5). Templates and the editor use it as the minimum shot duration. It is at
 * most 30 s, because only `framesAssetIds` count.
 */
export function framesDuration(layout: RowsLayout, aspect: Aspect): number {
  const { stepX } = rowsGeometry(layout, aspect);
  const period = Math.max(1, framesAssetIds(layout, aspect).length) * stepX;
  // The epsilon keeps an exact half second from rounding up a step.
  return Math.ceil((period / FRAMES_MAX_FRAME_HEIGHTS_PER_SECOND) * 2 - 1e-9) / 2;
}

export function resolveRowsLayout(
  layout: RowsLayout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  const { device = "browser", tilt = 12, speed = 0.25, travel = "steps" } = layout;
  // Frames shows only the screenshots that fit a 30 s shot (framesAssetIds).
  const assetIds = framesAssetIds(layout, aspect);
  const W = aspectRatioValue(aspect);
  const { numRows, itemW, itemH, stepX, stepY } = rowsGeometry(layout, aspect);

  // Angles in radians
  const rx = (tilt * 0.6 * Math.PI) / 180;
  const rz = (-tilt * Math.PI) / 180;

  const distinctAssets = assetIds.length > 0 ? assetIds : [assets[0]?.id ?? "empty"];
  const N = distinctAssets.length;
  const period = N * stepX;

  // Quality-bar §2.5: at most 0.12 frame widths per second, whatever N is. Frames ("period")
  // instead moves one whole period per loop, so frame(total) equals frame(0) with a cut wrap;
  // framesDuration keeps that under its own limit.
  const velocity =
    travel === "period"
      ? period / Math.max(0.1, shotDuration)
      : marqueeVelocity(speed, W, stepX, shotDuration);

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
    // Offset by half a period for adjacent rows. Frames ("period") spreads its rows over the
    // period instead (0, 1/3, 2/3 for three rows): its outer rows move together, so half a
    // period each would line up the same screenshot in the top and bottom rows for the whole
    // loop (quality-bar §4).
    const rowOffset = travel === "period" ? (r * period) / numRows : (r % 2) * (period / 2);
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
