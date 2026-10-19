import type { Aspect, Layout, Shot } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { ease } from "../easing";
import type { LayoutNode } from "./types";

type ResponsiveLayout = Extract<Layout, { kind: "responsive" }>;

/** Desktop card screen aspect (quality bar §3.1): tall pages scroll, so never the image's own. */
export const RESPONSIVE_DESKTOP_ASPECT = 1.6;
/** Mobile card screen aspect: the phone screen 9:19.5 (quality bar §3.4). */
export const RESPONSIVE_MOBILE_ASPECT = 0.4615;

// Quality bar §4 (Responsive Scroll), approved 18 Oct 2026: the pair spans at most 0.86 of the
// frame (the 7% safe margin) with a 0.05 gap side by side and 0.04 stacked.
const SAFE_SPAN = 0.86;
const SIDE_GAP = 0.05;
const STACK_GAP = 0.04;
const SIDE_MAX_HEIGHT = 0.66;
const STACK_MAX_MOBILE_HEIGHT = 0.6;
const ENTRANCE_DURATION = 0.8;
const STAGGER = 0.1;

export interface ResponsiveCard {
  width: number;
  height: number;
  x: number;
  y: number;
}

/** Where the two cards sit: side by side at 16:9, 4:3 and 1:1, stacked at 4:5 and 9:16. */
export function responsiveGeometry(aspect: Aspect): {
  desktop: ResponsiveCard;
  mobile: ResponsiveCard;
} {
  const W = aspectRatioValue(aspect);
  if (aspect === "4:5" || aspect === "9:16") {
    const deskW = SAFE_SPAN * W;
    const deskH = deskW / RESPONSIVE_DESKTOP_ASPECT;
    const mobH = Math.min(SAFE_SPAN - deskH - STACK_GAP, STACK_MAX_MOBILE_HEIGHT);
    const totalH = deskH + STACK_GAP + mobH;
    return {
      desktop: { width: deskW, height: deskH, x: 0, y: totalH / 2 - deskH / 2 },
      mobile: {
        width: mobH * RESPONSIVE_MOBILE_ASPECT,
        height: mobH,
        x: 0,
        y: -(totalH / 2 - mobH / 2),
      },
    };
  }
  const h = Math.min(
    SIDE_MAX_HEIGHT,
    (SAFE_SPAN * W - SIDE_GAP) / (RESPONSIVE_DESKTOP_ASPECT + RESPONSIVE_MOBILE_ASPECT),
  );
  const deskW = h * RESPONSIVE_DESKTOP_ASPECT;
  const mobW = h * RESPONSIVE_MOBILE_ASPECT;
  const totalW = deskW + SIDE_GAP + mobW;
  return {
    desktop: { width: deskW, height: h, x: -totalW / 2 + deskW / 2, y: 0 },
    mobile: { width: mobW, height: h, x: totalW / 2 - mobW / 2, y: 0 },
  };
}

/** Entrance opacity and offsets, as the pair layout does (quality bar §2.2). */
function entranceAt(entrance: Shot["entrance"], shotT: number, order: number) {
  const delay = entrance === "stagger" ? order * STAGGER : 0;
  const e = ease("expoOut", Math.max(0, Math.min(1, (shotT - delay) / ENTRANCE_DURATION)));
  switch (entrance) {
    case "rise":
      return { opacity: e, y: -(1 - e) * 0.03, scale: 1 };
    case "scale":
      return { opacity: e, y: 0, scale: 0.97 + 0.03 * e };
    case "stagger":
      return { opacity: e, y: -(1 - e) * 0.03, scale: 0.97 + 0.03 * e };
    default:
      return { opacity: 1, y: 0, scale: 1 };
  }
}

/**
 * The desktop and mobile cards of Responsive Scroll. Scroll is 0 here; `evaluate` sets both
 * screens' positions (motion/responsive-scroll.ts).
 */
export function resolveResponsiveLayout(
  layout: ResponsiveLayout,
  aspect: Aspect,
  shotT: number,
  entrance: Shot["entrance"] = "none",
): LayoutNode[] {
  const { desktop, mobile } = responsiveGeometry(aspect);
  const cards = [
    {
      id: "responsive:desktop",
      card: desktop,
      assetId: layout.desktopId,
      aspect: RESPONSIVE_DESKTOP_ASPECT,
    },
    {
      id: "responsive:mobile",
      card: mobile,
      assetId: layout.mobileId,
      aspect: RESPONSIVE_MOBILE_ASPECT,
    },
  ];
  return cards.map(({ id, card, assetId, aspect: screenAspect }, order) => {
    const e = entranceAt(entrance, shotT, order);
    return {
      id,
      device: "card",
      assetId: assetId || null,
      width: card.width,
      height: card.height,
      screenAspect,
      transform: { x: card.x, y: card.y + e.y, z: 0, rx: 0, ry: 0, rz: 0, scale: e.scale },
      opacity: e.opacity,
      scroll: 0,
      depthOrder: order,
    };
  });
}
