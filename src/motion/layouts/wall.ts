import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { type LayoutNode, screenAspectFor } from "./types";

const ENTRANCE_DURATION = 0.8;

// Isometric view angles: rx = -50°, rz = 35°
const WALL_RX = (-50 * Math.PI) / 180;
const WALL_RZ = (35 * Math.PI) / 180;

export function resolveWallLayout(
  layout: Extract<Layout, { kind: "wall" }>,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  const { assetIds, columns = 4, speed = 0.2 } = layout;
  const W = aspectRatioValue(aspect);

  const numCols = Math.max(3, Math.min(5, columns));

  const itemW = 0.46;
  const itemH = itemW / 1.6;
  const gapX = 0.08;
  const stepX = itemW + gapX;
  const gapY = 0.08;
  const stepY = itemH + gapY;

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
  const visibleSpan = diag * 3.0;

  const cycles = Math.max(2, Math.ceil(visibleSpan / period) + 1);
  const totalCount = cycles * N;
  const ringSpan = totalCount * stepY;

  const extraCols = 4;
  const colMin = -extraCols;
  const colMax = numCols - 1 + extraCols;

  const nodes: LayoutNode[] = [];

  for (let c = colMin; c <= colMax; c++) {
    const baseX = (c - (numCols - 1) / 2) * stepX;
    // Alternate columns offset by half a period
    const colOffset = Math.abs(c % 2) * (period / 2);
    // Drift along Y
    const shift = -velocity * shotT + colOffset;

    for (let j = 0; j < totalCount; j++) {
      const assetIdx = ((j + Math.abs(c) * 2) % N + N) % N;
      const assetId = distinctAssets[assetIdx];
      const asset = assets.find((a) => a.id === assetId);
      const scrAspect = screenAspectFor("card", asset);

      const rawY = j * stepY + shift;
      const modY = ((rawY % ringSpan) + ringSpan) % ringSpan;
      const posY = modY - ringSpan / 2;

      // Rotate point (baseX, posY, 0) about (0,0,0) by WALL_RZ around Z, then WALL_RX around X
      const x1 = baseX * Math.cos(WALL_RZ) - posY * Math.sin(WALL_RZ);
      const y1 = baseX * Math.sin(WALL_RZ) + posY * Math.cos(WALL_RZ);
      const z1 = 0;

      const x2 = x1;
      const y2 = y1 * Math.cos(WALL_RX) - z1 * Math.sin(WALL_RX);
      const z2 = y1 * Math.sin(WALL_RX) + z1 * Math.cos(WALL_RX);

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
        id: `wall:c${c}:item${j}`,
        device: "card",
        assetId: assetId === "empty" ? null : assetId,
        width: itemW,
        height: itemH,
        screenAspect: scrAspect,
        transform: {
          x: x2,
          y: y2,
          z: z2,
          rx: WALL_RX,
          ry: 0,
          rz: WALL_RZ,
          scale: entranceScale,
        },
        opacity,
        scroll: 0,
        depthOrder: (c - colMin) * totalCount + j,
      });
    }
  }

  return nodes;
}
