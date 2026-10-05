import type { Aspect, AssetRef, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import { resolvePairLayout } from "./pair";
import { type LayoutNode, screenAspectFor } from "./types";

const ENTRANCE_DURATION = 0.8;

export function resolveTrioLayout(
  layout: Extract<Layout, { kind: "trio" }>,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  const { desktopId, tabletId, mobileId } = layout;

  // Without a tablet, falls back to pair overlap
  if (!tabletId) {
    return resolvePairLayout(
      {
        kind: "pair",
        desktopId,
        mobileId,
        arrangement: "overlap",
      },
      aspect,
      assets,
      shotT,
      shotDuration,
      entrance,
    );
  }

  const desktopAsset = assets.find((a) => a.id === desktopId);
  const tabletAsset = assets.find((a) => a.id === tabletId);
  const mobileAsset = assets.find((a) => a.id === mobileId);

  const deskScreenAspect = screenAspectFor("browser", desktopAsset);
  const tabScreenAspect = screenAspectFor("tablet", tabletAsset);
  const mobScreenAspect = screenAspectFor("phone", mobileAsset);

  const W = aspectRatioValue(aspect);
  const isPortrait = aspect === "9:16" || aspect === "4:5";

  // Base sizing
  let deskW = isPortrait ? 0.65 * W : 0.52 * W;
  let deskH = deskW / deskScreenAspect + deskW * 0.042; // with chrome

  let tabH = deskH * 0.74;
  let tabW = tabH * tabScreenAspect;

  let phoneH = deskH * 0.70;
  let phoneW = phoneH * 0.488;

  let deskX = 0;
  let deskY = 0.05;

  let tabX = -deskW * 0.45;
  let tabY = -0.05;
  const tabZ = 0.05;

  let phoneX = deskW * 0.48;
  let phoneY = -0.07;
  const phoneZ = 0.09;

  // Bounds check and auto scale
  const minX = Math.min(deskX - deskW / 2, tabX - tabW / 2, phoneX - phoneW / 2);
  const maxX = Math.max(deskX + deskW / 2, tabX + tabW / 2, phoneX + phoneW / 2);
  const totalW = maxX - minX;

  const minY = Math.min(deskY - deskH / 2, tabY - tabH / 2, phoneY - phoneH / 2);
  const maxY = Math.max(deskY + deskH / 2, tabY + tabH / 2, phoneY + phoneH / 2);
  const totalH = maxY - minY;

  let scale = 1.0;
  if (totalW > 0.86 * W) {
    scale = Math.min(scale, (0.86 * W) / totalW);
  }
  if (totalH > 0.84) {
    scale = Math.min(scale, 0.84 / totalH);
  }

  if (scale < 1.0) {
    deskW *= scale;
    deskH *= scale;
    tabW *= scale;
    tabH *= scale;
    phoneW *= scale;
    phoneH *= scale;
    deskX *= scale;
    deskY *= scale;
    tabX *= scale;
    tabY *= scale;
    phoneX *= scale;
    phoneY *= scale;
  }

  // Center horizontally
  const finalMinX = Math.min(deskX - deskW / 2, tabX - tabW / 2, phoneX - phoneW / 2);
  const finalMaxX = Math.max(deskX + deskW / 2, tabX + tabW / 2, phoneX + phoneW / 2);
  const centerShift = (finalMinX + finalMaxX) / 2;
  deskX -= centerShift;
  tabX -= centerShift;
  phoneX -= centerShift;

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
  const tabEntrance = computeEntrance(1);
  const phoneEntrance = computeEntrance(2);

  return [
    {
      id: "trio:desktop",
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
      id: "trio:tablet",
      device: "tablet",
      assetId: tabletId || null,
      width: tabW,
      height: tabH,
      screenAspect: tabScreenAspect,
      transform: {
        x: tabX,
        y: tabY + tabEntrance.tf.y,
        z: tabZ,
        rx: 0,
        ry: 0,
        rz: 0,
        scale: tabEntrance.tf.scale,
      },
      opacity: tabEntrance.opacity,
      scroll: 0,
      depthOrder: 1,
    },
    {
      id: "trio:mobile",
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
      depthOrder: 2,
    },
  ];
}
