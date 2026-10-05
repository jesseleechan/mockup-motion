import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { type LayoutNode } from "./types";

const ENTRANCE_DURATION = 0.8;

export function resolveColumnsLayout(
  layout: Extract<Layout, { kind: "columns" }>,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  const { assetIds, columns = 3, tilt = 10, speed = 0.25 } = layout;
  const W = aspectRatioValue(aspect);

  const numCols = Math.max(2, Math.min(5, columns));
  let itemH: number;
  switch (numCols) {
    case 2:
      itemH = 0.70;
      break;
    case 3:
      itemH = 0.58;
      break;
    case 4:
      itemH = 0.48;
      break;
    case 5:
    default:
      itemH = 0.40;
      break;
  }
  const itemW = itemH * 0.488; // body aspect 0.488

  const gapX = 0.08 * W;
  const stepX = itemW + gapX;
  const gapY = 0.12;
  const stepY = itemH + gapY;

  // Angles in radians
  const rx = (tilt * 0.6 * Math.PI) / 180;
  const rz = (-tilt * Math.PI) / 180;

  const distinctAssets =
    assetIds.length > 0 ? assetIds : [assets[0]?.id ?? "empty"];
  const N = distinctAssets.length;
  const period = N * stepY;

  // Speed snapping
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

  const diag = Math.sqrt(W * W + 1.0);
  const visibleSpan = diag * 2.0;

  const cycles = Math.max(2, Math.ceil(visibleSpan / period) + 1);
  const totalCount = cycles * N;
  const ringSpan = totalCount * stepY;

  const nodes: LayoutNode[] = [];

  for (let c = 0; c < numCols; c++) {
    const dir = c % 2 === 0 ? -1 : 1;
    const colOffset = (c % 2) * (period / 2);
    const baseX = (c - (numCols - 1) / 2) * stepX;
    const shift = dir * velocity * shotT + colOffset;

    for (let j = 0; j < totalCount; j++) {
      const assetIdx = j % N;
      const assetId = distinctAssets[assetIdx];

      const rawY = j * stepY + shift;
      const modY = ((rawY % ringSpan) + ringSpan) % ringSpan;
      const posY = modY - ringSpan / 2;

      // Rotate point (baseX, posY, 0) about (0,0,0) by rz around Z, then rx around X
      const x1 = baseX * Math.cos(rz) - posY * Math.sin(rz);
      const y1 = baseX * Math.sin(rz) + posY * Math.cos(rz);
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
        id: `col${c}:item${j}`,
        device: "phone",
        assetId: assetId === "empty" ? null : assetId,
        width: itemW,
        height: itemH,
        screenAspect: 0.4615,
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
        depthOrder: c * totalCount + j,
      });
    }
  }

  return nodes;
}
