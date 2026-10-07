import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { type LayoutNode, screenAspectFor } from "./types";

const ENTRANCE_DURATION = 0.8;

// The grid is built flat in plane space (x across columns, y along them), then the whole
// plane is rotated: rz turns the columns onto a diagonal, rx tips the plane back so it
// reads as a surface seen from above. Tuned by eye with the isoDrift camera (F11).
export const WALL_RX = (-50 * Math.PI) / 180;
export const WALL_RZ = (35 * Math.PI) / 180;
// Gap between neighbouring cards as a fraction of the card width (F11: 4-6%).
export const WALL_GAP_FRACTION = 0.05;
// Card width at 4 columns: 0.2 + 0.19 * frame width, about 30% of a 16:9 frame and 55%
// of a 9:16 one, where a diagonal-based size would fill the narrow frame with one card.
const CARD_WIDTH_BASE = 0.2;
const CARD_WIDTH_PER_FRAME_WIDTH = 0.19;
const CARD_ASPECT = 1.6;

/** Rotates a plane-space point (z = 0) into stage space: around Z, then around X. */
export function wallPlanePoint(px: number, py: number): { x: number; y: number; z: number } {
  const x1 = px * Math.cos(WALL_RZ) - py * Math.sin(WALL_RZ);
  const y1 = px * Math.sin(WALL_RZ) + py * Math.cos(WALL_RZ);
  return { x: x1, y: y1 * Math.cos(WALL_RX), z: y1 * Math.sin(WALL_RX) };
}

/**
 * How many assets each column's sequence is shifted by, so that no card sits beside the
 * same screenshot in a neighbouring column (quality-bar §4). Alternate columns are offset
 * by half a period (N / 2 cards), so a card overlaps the neighbour cards whose position
 * differs from it by less than one card; the step must avoid each of those differences.
 */
export function columnAssetStep(N: number): number {
  const offset = N / 2;
  const forbidden = new Set<number>();
  for (let d = 0; d < N; d++) {
    const distance = Math.abs(d - offset);
    if (Math.min(distance, N - distance) < 1 - 1e-9) {
      forbidden.add(d);
      forbidden.add((N - d) % N);
    }
  }
  for (const step of [...Array(N).keys()].map((k) => (k + 1) % N)) {
    if (!forbidden.has(step)) return step;
  }
  return 1;
}

/**
 * Isometric wall: one tilted plane of cards. Columns drift along the plane's y axis,
 * alternate columns are offset by half a period, and the ring of cards in each column is
 * long enough that the wrap always happens outside the frame.
 */
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

  const itemW = (CARD_WIDTH_BASE + CARD_WIDTH_PER_FRAME_WIDTH * W) * (4 / numCols);
  const itemH = itemW / CARD_ASPECT;
  const gap = itemW * WALL_GAP_FRACTION;
  const stepX = itemW + gap;
  const stepY = itemH + gap;

  const distinctAssets = assetIds.length > 0 ? assetIds : [assets[0]?.id ?? "empty"];
  const N = distinctAssets.length;
  const period = N * stepY;

  // Speed snapping: an integer number of periods per shot keeps the loop seamless.
  const vMax = 0.12 * W;
  const duration = Math.max(0.1, shotDuration);
  const normalizedSpeed = Math.max(0.05, Math.min(1.0, speed));
  let k = Math.round((normalizedSpeed * vMax * duration) / period);
  if (k < 1) k = 1;
  while (k > 1 && (k * period) / duration > vMax) k--;
  const velocity = (k * period) / duration;

  // The frame seen on the tipped plane, in rotated-plane coordinates: the full width,
  // and the height stretched by 1 / cos(rx). One card of margin on every side covers
  // the isoDrift camera and its pan; tests/layouts.test.ts checks coverage.
  const halfA = W / 2 + itemW;
  const halfB = 0.5 / Math.cos(WALL_RX) + itemW;
  const cosZ = Math.abs(Math.cos(WALL_RZ));
  const sinZ = Math.abs(Math.sin(WALL_RZ));
  const halfX = halfA * cosZ + halfB * sinZ;
  const halfY = halfA * sinZ + halfB * cosZ;

  const colReach = Math.ceil(halfX / stepX);
  const cycles = Math.max(2, Math.ceil((2 * halfY + stepY) / period));
  const totalCount = cycles * N;
  const ringSpan = totalCount * stepY;

  let entranceOpacity = 1.0;
  let entranceScale = 1.0;
  if (entrance !== "none") {
    const e = ease("expoOut", Math.max(0, Math.min(1, shotT / ENTRANCE_DURATION)));
    entranceOpacity = e;
    entranceScale = 0.97 + 0.03 * e;
  }

  const assetStep = columnAssetStep(N);
  const nodes: LayoutNode[] = [];
  for (let c = -colReach; c <= colReach; c++) {
    const px = c * stepX;
    // Alternate columns are offset by half a period (quality-bar §4).
    const shift = -velocity * shotT + Math.abs(c % 2) * (period / 2);

    for (let j = 0; j < totalCount; j++) {
      const assetIdx = (((j + assetStep * c) % N) + N) % N;
      const assetId = distinctAssets[assetIdx];
      const asset = assets.find((a) => a.id === assetId);

      const rawY = j * stepY + shift;
      const py = (((rawY % ringSpan) + ringSpan) % ringSpan) - ringSpan / 2;
      const p = wallPlanePoint(px, py);

      nodes.push({
        id: `wall:c${c}:item${j}`,
        device: "card",
        assetId: assetId === "empty" ? null : assetId,
        width: itemW,
        height: itemH,
        screenAspect: screenAspectFor("card", asset),
        // Each card carries the plane's rotation, so its corners lie on the plane.
        transform: { x: p.x, y: p.y, z: p.z, rx: WALL_RX, ry: 0, rz: WALL_RZ, scale: entranceScale },
        opacity: entranceOpacity,
        scroll: 0,
        depthOrder: (c + colReach) * totalCount + j,
      });
    }
  }

  return nodes;
}
