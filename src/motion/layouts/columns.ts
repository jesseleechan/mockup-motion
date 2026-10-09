import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { lanesAssetIds, resolveLanes } from "./lanes";
import { marqueeVelocity } from "./marquee";
import { type LayoutNode } from "./types";

const ENTRANCE_DURATION = 0.8;

// Quality-bar §3.1: a phone's screen aspect (9:19.5), and a phone body's width / height.
const PHONE_SCREEN_ASPECT = 0.4615;
const PHONE_BODY_ASPECT = 0.488;

type ColumnsLayout = Extract<Layout, { kind: "columns" }>;

/**
 * Card size and pitch of a columns layout at an aspect, shared by the layout and
 * `framesDuration`. Unset Frames fields keep today's tilted phone sizes. A portrait card
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
  const { assetIds, tilt = 10, speed = 0.25, device = "phone", travel = "steps" } = layout;
  const W = aspectRatioValue(aspect);
  const { numCols, itemW, itemH, stepX, stepY } = columnsGeometry(layout, aspect);

  // Frames: columns are lanes moving vertically, shared with Desktop Frames' rows (lanes.ts).
  if (travel === "period") {
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

  // Angles in radians
  const rx = (tilt * 0.6 * Math.PI) / 180;
  const rz = (-tilt * Math.PI) / 180;

  const distinctAssets = assetIds.length > 0 ? assetIds : [assets[0]?.id ?? "empty"];
  const N = distinctAssets.length;
  const period = N * stepY;

  // Quality-bar §2.5: at most 0.12 frame widths per second, whatever N is.
  const velocity = marqueeVelocity(speed, W, stepY, shotDuration);

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
        device,
        assetId: assetId === "empty" ? null : assetId,
        width: itemW,
        height: itemH,
        screenAspect: PHONE_SCREEN_ASPECT,
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
