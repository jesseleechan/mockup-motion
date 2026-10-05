import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { type LayoutNode, screenAspectFor } from "./types";

const ENTRANCE_DURATION = 0.8;

export function resolveRowsLayout(
  layout: Extract<Layout, { kind: "rows" }>,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  const { assetIds, rows = 2, device = "browser", tilt = 12, speed = 0.25 } = layout;
  const W = aspectRatioValue(aspect);

  const numRows = Math.max(1, Math.min(3, rows)) as 1 | 2 | 3;
  let itemH = numRows === 1 ? 0.56 : numRows === 2 ? 0.42 : 0.32;
  const baseAspect = 1.6;
  const itemW = itemH * baseAspect;
  if (device === "browser") {
    itemH += itemW * 0.042; // chrome height
  }

  // Spacing so 3 assets easily span beyond the visible window (no repeats)
  const gapX = 0.14 * W;
  const stepX = itemW + gapX;
  const gapY = 0.06;
  const stepY = itemH + gapY;

  // Angles in radians
  const rx = (tilt * 0.6 * Math.PI) / 180;
  const rz = (-tilt * Math.PI) / 180;

  const distinctAssets =
    assetIds.length > 0 ? assetIds : [assets[0]?.id ?? "empty"];
  const N = distinctAssets.length;
  const period = N * stepX;

  // Speed snapping: snapped to k * period / totalDuration so loop is 100% seamless
  // Quality-bar §2.5: Never let marquee speed exceed 0.12 frame widths per second
  const vMax = 0.12 * W;
  const duration = Math.max(0.1, shotDuration);
  const normalizedSpeed = Math.max(0.05, Math.min(1.0, speed));
  const targetVelocity = normalizedSpeed * vMax;

  let k = Math.round((targetVelocity * duration) / period);
  if (k < 1) k = 1;
  while (k > 1 && (k * period) / duration > vMax) {
    k--;
  }
  const velocity = (k * period) / duration;

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
