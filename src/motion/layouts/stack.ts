import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { type LayoutNode, screenAspectFor } from "./types";

const ENTRANCE_DURATION = 0.8;

export function resolveStackLayout(
  layout: Extract<Layout, { kind: "stack" }>,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  _shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  const { assetIds, device = "browser", spread = 0.5 } = layout;
  const W = aspectRatioValue(aspect);

  const numDevices = Math.max(3, Math.min(5, assetIds.length > 0 ? assetIds.length : 3));

  // Device sizing
  let baseW = aspect === "16:9" || aspect === "4:3" ? 0.58 * W : 0.72 * W;
  let baseH = baseW / 1.6;
  if (device === "browser") {
    baseH += baseW * 0.042;
  }

  // Step offsets per quality-bar & spec
  // z step 0.06, x step 0.07, ry 6-10° by spread
  const normalizedSpread = Math.max(0, Math.min(1, spread));
  const ry = ((6 + 4 * normalizedSpread) * Math.PI) / 180;
  const zStep = 0.06;
  const xStep = 0.07 * (aspect === "9:16" ? 0.7 : 1.0);
  const yStep = 0.02;

  // Front device is at index numDevices - 1
  // Calculate bounding box to center and scale
  const totalXSpan = (numDevices - 1) * xStep;
  const totalYSpan = (numDevices - 1) * yStep;

  let scale = 1.0;
  if (baseW + totalXSpan > 0.86 * W) {
    scale = Math.min(scale, (0.86 * W) / (baseW + totalXSpan));
  }
  if (baseH + totalYSpan > 0.84) {
    scale = Math.min(scale, 0.84 / (baseH + totalYSpan));
  }

  baseW *= scale;
  baseH *= scale;
  const actualXStep = xStep * scale;
  const actualYStep = yStep * scale;

  // Center stack
  const startX = -((numDevices - 1) * actualXStep) / 2;
  const startY = ((numDevices - 1) * actualYStep) / 2;

  const nodes: LayoutNode[] = [];

  for (let i = 0; i < numDevices; i++) {
    const assetId = assetIds[i] ?? assets[i % (assets.length || 1)]?.id ?? null;
    const asset = assets.find((a) => a.id === assetId);
    const scrAspect = screenAspectFor(device, asset);

    // Front device is at i = numDevices - 1
    const x = startX + i * actualXStep;
    const y = startY - i * actualYStep;
    const z = i * zStep;

    // Entrance
    const p = Math.max(0, Math.min(1, (shotT - (entrance === "stagger" ? i * 0.1 : 0)) / ENTRANCE_DURATION));
    const e = ease("expoOut", p);
    let opacity: number;
    const tf = { y: 0, scale: 1.0 };

    switch (entrance) {
      case "rise":
        opacity = e;
        tf.y = -(1 - e) * 0.03;
        break;
      case "scale":
        opacity = e;
        tf.scale = 0.97 + 0.03 * e;
        break;
      case "stagger":
        opacity = e;
        tf.y = -(1 - e) * 0.03;
        tf.scale = 0.97 + 0.03 * e;
        break;
      case "none":
      default:
        opacity = 1.0;
        break;
    }

    nodes.push({
      id: `stack:${i}`,
      device,
      assetId: assetId || null,
      width: baseW,
      height: baseH,
      screenAspect: scrAspect,
      transform: {
        x,
        y: y + tf.y,
        z,
        rx: 0,
        ry,
        rz: 0,
        scale: tf.scale,
      },
      opacity,
      scroll: 0,
      depthOrder: i,
    });
  }

  return nodes;
}
