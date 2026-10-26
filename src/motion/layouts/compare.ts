import type { Aspect, AssetRef, Layout } from "../../doc/types";
import { ease } from "../easing";
import { PHONE_BORDER, PHONE_SCREEN_ASPECT } from "../phone-spec";
import { singleDeviceSize } from "./single";
import { mainPane } from "./tour";
import { type LayoutNode, type ScreenDivider, type ScreenPane, screenAspectFor } from "./types";

type CompareLayout = Extract<Layout, { kind: "compare" }>;

/**
 * The loop wrap crossfade (quality bar §2.2): a looping shot fades from its end into its start
 * over its last 0.8 s, so it lasts its loop plus this.
 */
export const COMPARE_WRAP_OVERLAP = 0.8;

/**
 * Before & After's loop at the Default pace (presets round two, D8): 1.0 s on the old design, a
 * 2.0 s sweep, a hold on the new design, then the 0.8 s wrap crossfade back to the old one.
 */
export const COMPARE_LOOP = 6;

// The old design's hold and the sweep as fractions of the loop: 1.0 s and 2.0 s of the Default
// 6.0 s. Pace scales the loop (D13), so both scale with it; the wrap crossfade stays 0.8 s.
const HOLD_FRACTION = 1 / 6;
const SWEEP_FRACTION = 2 / 6;

// Quality bar §4 (Before & After): the labels' text is 1.75% of the screen's width (the preview's
// 0.028 of a 1.6 screen's height), and at least 1.85% of the frame height, so a label stays
// legible on a small screen (the preview's 8 px floor on its 430 px stage).
const LABEL_SIZE_OF_SCREEN = 0.0175;
const LABEL_MIN_SIZE = 0.0185;
// The divider is 0.4% of the screen's width, and at least 0.35% of the frame height (the
// preview's 1.5 px floor).
const DIVIDER_WIDTH_OF_SCREEN = 0.004;
const DIVIDER_MIN_WIDTH = 0.0035;
// The divider fades in over the first 2% of the screen it crosses and out over the last 2%, so
// it never sits on the screen's edge like a border.
const DIVIDER_FADE = 0.02;

/** The labels' text: UI copy, in sentence case. */
export const BEFORE_LABEL = "Before";
export const AFTER_LABEL = "After";

/** The shot length for a loop of `loop` seconds: the loop plus the wrap crossfade it overlaps. */
export function compareDuration(loop: number): number {
  return loop + COMPARE_WRAP_OVERLAP;
}

export interface CompareTiming {
  /** Seconds from the shot's start to its loop point. */
  loop: number;
  /** When the new design starts to sweep across the old one, and when it covers it. */
  sweepStart: number;
  sweepEnd: number;
}

/**
 * The timeline of a Before & After shot of `duration` seconds: its loop is the duration less the
 * wrap crossfade; the old design holds for a sixth of it, then the sweep takes a third. At the
 * Default 6.8 s: 1.0 s on the old design, the sweep from 1.0 to 3.0 s, the new design until the
 * wrap crossfade starts at 5.2 s, and the loop point at 6.0 s.
 */
export function compareTiming(duration: number): CompareTiming {
  const loop = Math.max(0, duration - COMPARE_WRAP_OVERLAP);
  const sweepStart = loop * HOLD_FRACTION;
  return { loop, sweepStart, sweepEnd: sweepStart + loop * SWEEP_FRACTION };
}

/**
 * The sweep's edge at shot time `t`, in screen widths from the left: 0 while the old design
 * holds, then eased on `smooth` (quality bar §2.1) to 1, where it stays. It never moves back.
 */
export function compareEdge(t: number, duration: number): number {
  const { sweepStart, sweepEnd } = compareTiming(duration);
  if (sweepEnd <= sweepStart) return t >= sweepStart ? 1 : 0;
  return ease("smooth", (t - sweepStart) / (sweepEnd - sweepStart));
}

/**
 * The two panes of a Before & After screen (contracts.md §4): both designs fit the whole screen
 * (offset 0), the old one drawn right of the edge and the new one left of it, so the new design
 * sweeps in from the left. Each carries its label: "Before" top right, "After" top left.
 */
export function comparePanes(
  beforeId: string | null,
  afterId: string | null,
  edge: number,
  labelSize: number,
): ScreenPane[] {
  return [
    {
      assetId: beforeId,
      offset: 0,
      clip: [edge, 1],
      scroll: 0,
      label: { text: BEFORE_LABEL, corner: "right", size: labelSize },
    },
    {
      assetId: afterId,
      offset: 0,
      clip: [0, edge],
      scroll: 0,
      label: { text: AFTER_LABEL, corner: "left", size: labelSize },
    },
  ];
}

/** The divider at the sweep's edge: hidden before and after the sweep, faded near the edges. */
export function compareDivider(edge: number, width: number): ScreenDivider {
  const opacity = Math.max(0, Math.min(1, Math.min(edge, 1 - edge) / DIVIDER_FADE));
  return { x: edge, opacity, width };
}

/** The device Before & After shows both designs on, and its screen. */
export interface CompareGeometry {
  width: number;
  height: number;
  screenAspect: number;
  /** The screen's width in stage units: the browser's, or the phone's inside its border. */
  screenWidth: number;
  /** The labels' font size and the divider's width, in stage units (quality bar §4). */
  labelSize: number;
  dividerWidth: number;
}

/**
 * Before & After's device (quality bar §4): Scroll Story's single browser or phone, centred. The
 * browser's screen takes the new design's aspect by the desktop rule (quality bar §3.1), or the
 * old design's while there is no new one; both designs are fit to its width.
 */
export function compareGeometry(
  layout: CompareLayout,
  aspect: Aspect,
  assets: AssetRef[],
): CompareGeometry {
  const sized =
    assets.find((a) => a.id === layout.afterId) ?? assets.find((a) => a.id === layout.beforeId);
  const screenAspect =
    layout.device === "phone" ? PHONE_SCREEN_ASPECT : screenAspectFor("browser", sized);
  const { width, height } = singleDeviceSize(layout.device, aspect, screenAspect);
  const screenWidth = layout.device === "phone" ? width * (1 - 2 * PHONE_BORDER) : width;
  return {
    width,
    height,
    screenAspect,
    screenWidth,
    labelSize: Math.max(LABEL_MIN_SIZE, screenWidth * LABEL_SIZE_OF_SCREEN),
    dividerWidth: Math.max(DIVIDER_MIN_WIDTH, screenWidth * DIVIDER_WIDTH_OF_SCREEN),
  };
}

/**
 * Before & After (presets round two, D6–D8): one browser or phone, centred and still, whose
 * screen shows the old design until the new one sweeps across it, left to right, with a divider
 * at the edge. Every frame lists both panes and the divider.
 */
export function resolveCompareLayout(
  layout: CompareLayout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
): LayoutNode[] {
  const edge = compareEdge(shotT, shotDuration);
  const geometry = compareGeometry(layout, aspect, assets);
  const panes = comparePanes(
    layout.beforeId || null,
    layout.afterId || null,
    edge,
    geometry.labelSize,
  );
  return [
    {
      id: "compare:screen",
      device: layout.device,
      assetId: mainPane(panes)?.assetId ?? null,
      width: geometry.width,
      height: geometry.height,
      screenAspect: geometry.screenAspect,
      transform: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
      opacity: 1,
      scroll: 0,
      depthOrder: 0,
      panes,
      divider: compareDivider(edge, geometry.dividerWidth),
    },
  ];
}
