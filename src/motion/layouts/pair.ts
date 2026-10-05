import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { type LayoutNode, screenAspectFor } from "./types";

const ENTRANCE_DURATION = 0.8;

export function resolvePairLayout(
  layout: Extract<Layout, { kind: "pair" }>,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  _shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  const { desktopId, mobileId, arrangement } = layout;
  const desktopAsset = assets.find((a) => a.id === desktopId);
  const mobileAsset = assets.find((a) => a.id === mobileId);

  const deskScreenAspect = screenAspectFor("browser", desktopAsset);
  const mobScreenAspect = screenAspectFor("phone", mobileAsset);

  const W = aspectRatioValue(aspect);
  const isPortrait = aspect === "9:16" || aspect === "4:5";

  // Base sizing
  let deskW: number;
  let deskH: number;

  if (isPortrait) {
    deskW = 0.78 * W;
  } else if (aspect === "1:1") {
    deskW = 0.65 * W;
  } else {
    deskW = arrangement === "side" ? 0.52 * W : 0.62 * W;
  }

  deskH = deskW / deskScreenAspect + deskW * 0.042; // with chrome

  // Phone height is 78-86% of browser height (quality-bar §4)
  let phoneH = deskH * 0.82;
  let phoneW = phoneH * 0.488; // body aspect 0.488

  let deskX: number;
  let deskY: number;
  let phoneX: number;
  let phoneY: number;
  let phoneZ = 0.04; // in front

  if (arrangement === "overlap") {
    if (isPortrait) {
      // Phone lower-right over the browser's bottom third
      deskY = 0.12;
      phoneY = deskY - deskH * 0.35;
      deskX = -0.05 * W;
      phoneX = deskX + deskW * 0.38;

      // Check vertical safe margin
      const top = deskY + deskH / 2;
      const bottom = phoneY - phoneH / 2;
      const totalH = top - bottom;
      if (totalH > 0.84) {
        const s = 0.84 / totalH;
        deskW *= s;
        deskH *= s;
        phoneW *= s;
        phoneH *= s;
        deskY = 0.12 * s;
        phoneY = deskY - deskH * 0.35;
        deskX = -0.05 * W * s;
        phoneX = deskX + deskW * 0.38;
      }
    } else {
      // Overlap: phone overlaps right edge by 10-16% (13%) of browser width
      const overlapPx = deskW * 0.13;
      // Phone left edge is deskW/2 - overlapPx
      const deskLeft = -deskW / 2;
      const deskRight = deskW / 2;
      const phoneLeft = deskRight - overlapPx;
      const phoneRight = phoneLeft + phoneW;
      const totalW = phoneRight - deskLeft;
      const center = (deskLeft + phoneRight) / 2;

      // Adjust so group is centered at x = 0
      deskX = -center;
      phoneX = phoneLeft + phoneW / 2 - center;

      deskY = 0.02;
      phoneY = deskY - deskH * 0.08;

      // Scale down if exceeding safe margins
      const maxH = Math.max(deskH, phoneH);
      let scale = 1.0;
      if (totalW > 0.86 * W) {
        scale = Math.min(scale, (0.86 * W) / totalW);
      }
      if (maxH > 0.84) {
        scale = Math.min(scale, 0.84 / maxH);
      }
      if (scale < 1.0) {
        deskW *= scale;
        deskH *= scale;
        phoneW *= scale;
        phoneH *= scale;
        deskX *= scale;
        phoneX *= scale;
        deskY *= scale;
        phoneY *= scale;
      }
    }
  } else {
    // arrangement === "side"
    // gap is 6% of frame width
    const gap = 0.06 * W;
    const totalW = deskW + gap + phoneW;
    const maxH = Math.max(deskH, phoneH);

    let scale = 1.0;
    if (totalW > 0.86 * W) {
      scale = Math.min(scale, (0.86 * W) / totalW);
    }
    if (maxH > 0.84) {
      scale = Math.min(scale, 0.84 / maxH);
    }
    if (scale < 1.0) {
      deskW *= scale;
      deskH *= scale;
      phoneW *= scale;
      phoneH *= scale;
    }

    const effectiveTotalW = deskW + gap + phoneW;
    deskX = -effectiveTotalW / 2 + deskW / 2;
    phoneX = effectiveTotalW / 2 - phoneW / 2;
    deskY = 0;
    phoneY = 0;
    phoneZ = 0.01;
  }

  // Entrance handling (depth-aware stagger)
  const computeEntrance = (order: number) => {
    const p = Math.max(0, Math.min(1, (shotT - (entrance === "stagger" ? order * 0.1 : 0)) / ENTRANCE_DURATION));
    const e = ease("expoOut", p);
    let opacity: number;
    const tf = { x: 0, y: 0, scale: 1.0 };

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
    return { opacity, tf };
  };

  const deskEntrance = computeEntrance(0);
  const phoneEntrance = computeEntrance(1);

  return [
    {
      id: "pair:desktop",
      device: "browser",
      assetId: desktopId || null,
      width: deskW,
      height: deskH,
      screenAspect: deskScreenAspect,
      transform: {
        x: deskX,
        y: deskY + deskEntrance.tf.y,
        z: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        scale: deskEntrance.tf.scale,
      },
      opacity: deskEntrance.opacity,
      scroll: 0,
      depthOrder: 0,
    },
    {
      id: "pair:mobile",
      device: "phone",
      assetId: mobileId || null,
      width: phoneW,
      height: phoneH,
      screenAspect: mobScreenAspect,
      transform: {
        x: phoneX,
        y: phoneY + phoneEntrance.tf.y,
        z: phoneZ,
        rx: 0,
        ry: 0,
        rz: 0,
        scale: phoneEntrance.tf.scale,
      },
      opacity: phoneEntrance.opacity,
      scroll: 0,
      depthOrder: 1,
    },
  ];
}
