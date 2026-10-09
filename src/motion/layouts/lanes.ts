import type { AssetRef, DeviceKind, Shot } from "../../doc/types";
import { ease } from "../easing";
import { MAX_SHOT_DURATION } from "./limits";
import { FRAMES_MAX_FRAME_HEIGHTS_PER_SECOND } from "./marquee";
import { type LayoutNode, screenAspectFor } from "./types";

const ENTRANCE_DURATION = 0.8;

/**
 * The axis lanes move on. "x": the lanes are rows moving sideways (Desktop Frames). "y": the
 * lanes are columns moving vertically (Mobile Frames).
 */
export type LaneAxis = "x" | "y";

/** Card size and spacing of a lane layout, in stage units. */
export interface LaneGeometry {
  lanes: number;
  /** Card length along a lane. */
  along: number;
  /** Card size across the lanes. */
  across: number;
  /** Card length plus gap along a lane. */
  pitch: number;
  /** Card size plus gap across the lanes. */
  lanePitch: number;
}

export interface LaneOptions {
  axis: LaneAxis;
  geometry: LaneGeometry;
  device: DeviceKind;
  /** A fixed screen aspect for every card; unset follows `screenAspectFor(device, asset)`. */
  screenAspect?: number;
  /** The screenshots in ring order, already capped by `lanesAssetIds`. */
  assetIds: string[];
  assets: AssetRef[];
  frameWidth: number;
  tilt: number;
  shotT: number;
  shotDuration: number;
  entrance: Shot["entrance"];
}

/**
 * The screenshots a Frames layout shows: the first ones whose period fits a 30 s shot at 0.20
 * stage units per second along the lane (quality-bar §2.2). Later ones are left out.
 */
export function lanesAssetIds(assetIds: string[], pitch: number): string[] {
  // The epsilon keeps an exact fit from rounding down.
  const fit = Math.floor((MAX_SHOT_DURATION * FRAMES_MAX_FRAME_HEIGHTS_PER_SECOND) / pitch + 1e-9);
  return assetIds.slice(0, Math.max(1, fit));
}

/**
 * The shortest shot, rounded up to 0.5 s, in which `count` screenshots move one period at no
 * more than 0.20 stage units per second along the lane (quality-bar §2.5).
 */
export function lanesDuration(count: number, pitch: number): number {
  const period = Math.max(1, count) * pitch;
  // The epsilon keeps an exact half second from rounding up a step.
  return Math.ceil((period / FRAMES_MAX_FRAME_HEIGHTS_PER_SECOND) * 2 - 1e-9) / 2;
}

/**
 * The Frames period mode on one axis (contracts.md §5). Every lane moves exactly one asset
 * period per shot at one shared speed, so frame(total) equals frame(0) with a cut wrap.
 * Adjacent lanes move in opposite directions: the first row moves left, the first (leftmost)
 * column moves up. Lane r starts r / lanes of a period along, so lanes that move together never
 * line up the same screenshot (quality-bar §4). Node ids and sizes don't depend on time.
 */
export function resolveLanes(options: LaneOptions): LayoutNode[] {
  const { axis, geometry, device, assetIds, assets, frameWidth, tilt, shotT, shotDuration } =
    options;
  const { lanes, along, across, pitch, lanePitch } = geometry;

  // Angles in radians
  const rx = (tilt * 0.6 * Math.PI) / 180;
  const rz = (-tilt * Math.PI) / 180;

  const distinctAssets = assetIds.length > 0 ? assetIds : [assets[0]?.id ?? "empty"];
  const N = distinctAssets.length;
  const period = N * pitch;
  const velocity = period / Math.max(0.1, shotDuration);

  // Diagonal span with margin to guarantee full bleed coverage under tilt
  const diag = Math.sqrt(frameWidth * frameWidth + 1.0);
  const visibleSpan = diag * 2.0;

  // Ring size: multiple of the period that comfortably covers visibleSpan
  const cycles = Math.max(2, Math.ceil(visibleSpan / period) + 1);
  const totalCount = cycles * N;
  const ringSpan = totalCount * pitch;

  const idPrefix = axis === "x" ? "row" : "col";
  const width = axis === "x" ? along : across;
  const height = axis === "x" ? across : along;

  const nodes: LayoutNode[] = [];

  for (let r = 0; r < lanes; r++) {
    // Rows: the first moves left (-x). Columns: the first moves up (+y).
    const forward = r % 2 === 0;
    const dir = axis === "x" ? (forward ? -1 : 1) : forward ? 1 : -1;
    const laneOffset = (r * period) / lanes;
    const base = (r - (lanes - 1) / 2) * lanePitch;
    const shift = dir * velocity * shotT + laneOffset;

    for (let j = 0; j < totalCount; j++) {
      const assetIdx = j % N;
      const assetId = distinctAssets[assetIdx];
      const asset = assets.find((a) => a.id === assetId);
      const scrAspect = options.screenAspect ?? screenAspectFor(device, asset);

      // Ring positioning: modulo ringSpan, centered
      const raw = j * pitch + shift;
      const mod = ((raw % ringSpan) + ringSpan) % ringSpan;
      const pos = mod - ringSpan / 2;
      const x = axis === "x" ? pos : base;
      const y = axis === "x" ? base : pos;

      // Rotate point (x, y, 0) about (0,0,0) by rz around Z, then rx around X
      const x1 = x * Math.cos(rz) - y * Math.sin(rz);
      const y1 = x * Math.sin(rz) + y * Math.cos(rz);
      const z1 = 0;

      const x2 = x1;
      const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
      const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);

      // Entrance calculation
      let opacity = 1.0;
      let entranceScale = 1.0;
      if (options.entrance !== "none") {
        const p = Math.max(0, Math.min(1, shotT / ENTRANCE_DURATION));
        const e = ease("expoOut", p);
        opacity = e;
        entranceScale = 0.97 + 0.03 * e;
      }

      nodes.push({
        id: `${idPrefix}${r}:item${j}`,
        device,
        assetId: assetId === "empty" ? null : assetId,
        width,
        height,
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
