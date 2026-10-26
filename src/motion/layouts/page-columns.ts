/**
 * Page Columns (docs/presets-2-plan, D9–D11): full pages side by side as frameless cards. Each
 * column drifts through its own page at a constant speed, neighbours in opposite directions, and
 * the loop returns every column to its start with the 0.8 s wrap crossfade (contracts.md §5).
 */
import type { Aspect, AssetRef, Layout } from "../../doc/types";
import { aspectRatioValue } from "../camera";
import { PHONE_SCREEN_ASPECT } from "../phone-spec";
import { RESPONSIVE_WRAP_OVERLAP } from "../responsive-scroll";
import { scrollableFramesFor } from "../scroll";
import { MAX_SHOT_DURATION } from "./limits";
import type { LayoutNode } from "./types";

export type PageColumnsLayout = Extract<Layout, { kind: "pageColumns" }>;

// Quality bar §4 (Page Columns): the columns span 0.86 of the frame width (the 7% safe margin)
// with a 0.035 gap. Desktop windows are 0.84 of the frame tall, as tall as a single desktop
// screen may be (quality bar §4); mobile ones 0.8, the central 80% of a vertical format.
const SAFE_SPAN = 0.86;
const COLUMN_GAP = 0.035;
const DESKTOP_COLUMN_HEIGHT = 0.84;
const MOBILE_COLUMN_HEIGHT = 0.8;

/** The most pages a shot shows: 3 columns, the most at any aspect (plan D11). */
export const PAGE_COLUMNS_MAX_SCREENSHOTS = 3;

/**
 * Columns per shape and aspect (plan D11, quality bar §4). Desktop has fewer, wider columns than
 * mobile at 4:3, 1:1, 4:5 and 9:16 (owner, 26 October 2026): a desktop page in a column as narrow
 * as a mobile one is about as short as its column, so it stayed still or barely moved. One
 * desktop column shows the first page only.
 */
const COLUMN_COUNTS: Record<PageColumnsLayout["shape"], Record<Aspect, number>> = {
  desktop: { "16:9": 3, "4:3": 2, "1:1": 2, "4:5": 1, "9:16": 1 },
  mobile: { "16:9": 3, "4:3": 3, "1:1": 3, "4:5": 2, "9:16": 2 },
};

/** Plan D10: a column drifts at most half its height per second. */
export const PAGE_COLUMNS_SPEED_LIMIT = 0.5;
/** Plan D10: the Default loop is at least 12 s, even when every page is short. */
export const PAGE_COLUMNS_MIN_LOOP = 12;
/** The shot runs this much past the loop, so the wrap crossfade has the loop's last 0.8 s. */
export const PAGE_COLUMNS_WRAP_OVERLAP = RESPONSIVE_WRAP_OVERLAP;
/** The longest loop: the shot, 0.8 s longer, fits in 30 s. */
export const PAGE_COLUMNS_MAX_LOOP = MAX_SHOT_DURATION - PAGE_COLUMNS_WRAP_OVERLAP;

/**
 * Columns at an aspect (plan D11). Desktop: 3 at 16:9, 2 at 4:3 and 1:1, 1 at 4:5 and 9:16.
 * Mobile: 3 at 16:9, 4:3 and 1:1, 2 at 4:5 and 9:16.
 */
export function pageColumnsCount(shape: PageColumnsLayout["shape"], aspect: Aspect): number {
  return COLUMN_COUNTS[shape][aspect];
}

/** The pages a shot shows at an aspect: the first ones, one per column. */
export function pageColumnsAssetIds(layout: PageColumnsLayout, aspect: Aspect): string[] {
  return layout.assetIds.slice(0, pageColumnsCount(layout.shape, aspect));
}

export interface PageColumnsGeometry {
  /** A column's width and its window's height; a short page's card is shorter. */
  width: number;
  height: number;
  /** Column centres, left to right. */
  xs: number[];
}

/**
 * `columns` columns centred in the frame. A desktop column fills its share of the span; a mobile
 * one is no wider than a phone screen (quality bar §3.4), so at 16:9 the group is narrower.
 */
export function pageColumnsGeometry(
  shape: PageColumnsLayout["shape"],
  aspect: Aspect,
  columns: number,
): PageColumnsGeometry {
  const n = Math.max(1, columns);
  const share = (SAFE_SPAN * aspectRatioValue(aspect) - (n - 1) * COLUMN_GAP) / n;
  const height = shape === "mobile" ? MOBILE_COLUMN_HEIGHT : DESKTOP_COLUMN_HEIGHT;
  const width = shape === "mobile" ? Math.min(share, height * PHONE_SCREEN_ASPECT) : share;
  const span = n * width + (n - 1) * COLUMN_GAP;
  const xs = Array.from({ length: n }, (_, i) => -span / 2 + width / 2 + i * (width + COLUMN_GAP));
  return { width, height, xs };
}

export interface PageColumn {
  assetId: string | null;
  x: number;
  width: number;
  /** The card's height: the window's, or a short page's own, so a short page shows whole. */
  height: number;
  /** How far the page scrolls in its window, in column heights (0 for a short page). */
  range: number;
  /** "up": the page moves up from its top. "down": it moves down from its bottom. */
  direction: "up" | "down";
}

/**
 * The shot's columns. Each page fits the column width (never cropped at the sides, quality bar
 * §3.1). A page shorter than its window, such as a hero, shows whole on a card as tall as the
 * page and stays still. The first column moves up and its neighbours alternate, so with three
 * the middle one moves down from the bottom of its page.
 */
export function pageColumns(
  layout: PageColumnsLayout,
  aspect: Aspect,
  assets: AssetRef[],
): PageColumn[] {
  const shown = pageColumnsAssetIds(layout, aspect);
  const ids: (string | null)[] = shown.length > 0 ? shown : [null];
  const { width, height, xs } = pageColumnsGeometry(layout.shape, aspect, ids.length);
  return ids.map((assetId, i) => {
    const asset = assetId ? assets.find((a) => a.id === assetId) : undefined;
    const pageHeight = asset?.width && asset.height ? (width * asset.height) / asset.width : height;
    return {
      assetId,
      x: xs[i],
      width,
      height: Math.min(height, pageHeight),
      range: scrollableFramesFor("card", width / height, asset),
      direction: i % 2 === 0 ? "up" : "down",
    };
  });
}

/** The loop of a shot lasting `duration`: the shot runs 0.8 s past it for the wrap crossfade. */
export function pageColumnsLoop(duration: number): number {
  return Math.max(1e-3, duration - PAGE_COLUMNS_WRAP_OVERLAP);
}

/**
 * A column's scroll at shot time `t`, as a 0..1 fraction of its range. It moves at one speed
 * from t = 0 to the loop's end and never reverses: its whole page, or only as far as the speed
 * limit allows in the loop. During the wrap crossfade the outgoing layer keeps drifting while the
 * incoming one holds its first frame (contracts.md §5).
 */
export function pageColumnScroll(column: PageColumn, t: number, duration: number): number {
  if (column.range <= 0) return 0;
  const loop = pageColumnsLoop(duration);
  const travel = Math.min(column.range, PAGE_COLUMNS_SPEED_LIMIT * loop);
  const moved = travel * Math.min(1, Math.max(0, t / loop));
  return (column.direction === "up" ? moved : column.range - moved) / column.range;
}

// Rounds up to the 0.5 s steps of the loop; the epsilon keeps float noise (12.0000001) down.
const ceilHalf = (seconds: number) => Math.ceil(seconds * 2 - 1e-9) / 2;
const roundHalf = (seconds: number) => Math.round(seconds * 2) / 2;
const tidy = (seconds: number) => Math.round(seconds * 1000) / 1000;

/** The shortest loop at which the longest shown page keeps to the speed limit, in 0.5 s steps. */
export function pageColumnsShortestLoop(
  layout: PageColumnsLayout,
  aspect: Aspect,
  assets: AssetRef[],
): number {
  const longest = Math.max(0, ...pageColumns(layout, aspect, assets).map((c) => c.range));
  return ceilHalf(longest / PAGE_COLUMNS_SPEED_LIMIT);
}

/**
 * The Default loop (plan D10): the shortest of 12 s and up at which the longest page keeps to
 * 0.5 column heights per second, at most 29.2 s. Past that, columns travel only as far as the
 * limit allows (`pageColumnScroll`).
 */
export function pageColumnsDefaultLoop(
  layout: PageColumnsLayout,
  aspect: Aspect,
  assets: AssetRef[],
): number {
  const shortest = pageColumnsShortestLoop(layout, aspect, assets);
  return Math.min(PAGE_COLUMNS_MAX_LOOP, Math.max(PAGE_COLUMNS_MIN_LOOP, shortest));
}

/**
 * The shot duration at a pace's time scale (×1.2 Calm, ×0.8 Brisk; plan D13): the Default loop
 * scaled in 0.5 s steps, never faster than the speed limit nor longer than 29.2 s, plus the wrap
 * crossfade's 0.8 s. Brisk may go under the Default's 12 s floor; the speed limit still holds.
 */
export function pageColumnsPacedDuration(
  layout: PageColumnsLayout,
  aspect: Aspect,
  assets: AssetRef[],
  scale: number,
): number {
  const shortest = pageColumnsShortestLoop(layout, aspect, assets);
  const base = pageColumnsDefaultLoop(layout, aspect, assets);
  const loop = Math.min(PAGE_COLUMNS_MAX_LOOP, Math.max(shortest, roundHalf(base * scale)));
  return tidy(loop + PAGE_COLUMNS_WRAP_OVERLAP);
}

/**
 * One card per shown page, drifting through it (contracts.md §4). Node ids and sizes don't
 * depend on time, so the device pool builds every card from the layout at t = 0.
 */
export function resolvePageColumnsLayout(
  layout: PageColumnsLayout,
  aspect: Aspect,
  assets: AssetRef[],
  shotT: number,
  shotDuration: number,
): LayoutNode[] {
  return pageColumns(layout, aspect, assets).map((column, i) => ({
    id: `pageColumns:${i}`,
    device: "card",
    assetId: column.assetId,
    width: column.width,
    height: column.height,
    screenAspect: column.width / column.height,
    transform: { x: column.x, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
    opacity: 1,
    scroll: pageColumnScroll(column, shotT, shotDuration),
    depthOrder: i,
    cardShape: layout.shape,
  }));
}
