import { collectAssetIds, layoutAssetIds } from "../../doc/assets";
import type { ExportQuality, ProjectDoc, Shot } from "../../doc/types";
import {
  aspectRatioValue,
  cameraPose,
  PHONE_BORDER,
  resolveLayout,
  type LayoutNode,
} from "../../motion";

export interface TextureSizingOptions {
  outputWidthPx: number;
  supersample: number;
  quality?: ExportQuality;
  /** Lab-only fixed camera distance (EngineOptions.cameraDistanceOverride). */
  cameraDistanceOverride?: number;
}

const WIDTH_STEP = 256;
const CAMERA_SAMPLES = 5;

/** Quality-bar §3.1: about 1.5× the largest on-screen width, 2× for master. */
function oversampleFor(quality: ExportQuality | undefined): number {
  return quality === "master" ? 2.0 : 1.5;
}

function smallestCameraDistance(doc: ProjectDoc, shotIndex: number): number {
  const shot = doc.shots[shotIndex];
  let smallest = Infinity;
  for (let i = 0; i < CAMERA_SAMPLES; i++) {
    const p = i / (CAMERA_SAMPLES - 1);
    const pose = cameraPose(shot.camera, doc.aspect, p);
    smallest = Math.min(smallest, pose.distance);
  }
  // Guard against a degenerate preset: never size for a camera closer than 0.25×.
  return Math.max(0.25, smallest);
}

/**
 * Decode width in px for every image asset the document draws. Each screen asset
 * gets the largest width at which any of its nodes appears on screen (at the
 * shot's closest camera), times the quality oversample, clamped to the asset's
 * real width and rounded up to a multiple of 256 (minimum 256). The keys are
 * exactly `collectAssetIds(doc)`.
 */
export function textureWidths(doc: ProjectDoc, opts: TextureSizingOptions): Map<string, number> {
  const stageWidthUnits = aspectRatioValue(doc.aspect);
  const framePx = opts.outputWidthPx * opts.supersample;
  const oversample = oversampleFor(opts.quality);
  const needed = new Map<string, number>();
  const want = (assetId: string | null | undefined, widthPx: number) => {
    if (!assetId) return;
    needed.set(assetId, Math.max(needed.get(assetId) ?? 0, widthPx));
  };

  doc.shots.forEach((shot, shotIndex) => {
    const distance = opts.cameraDistanceOverride ?? smallestCameraDistance(doc, shotIndex);
    const nodes = resolveLayout(shot.layout, doc.aspect, doc.assets, 0, shot.duration);
    for (const node of nodes) {
      const onScreenPx = ((node.width * node.transform.scale) / stageWidthUnits) * framePx;
      want(node.assetId, (onScreenPx / distance) * oversample);
      // A screen of several panes lists every screenshot it shows (contracts.md §4), each at the
      // screen's width.
      for (const pane of node.panes ?? []) want(pane.assetId, (onScreenPx / distance) * oversample);
    }
  });
  // A layout can list more assets than it places at t = 0; size those for a full frame.
  for (const assetId of collectAssetIds(doc)) {
    if (!needed.has(assetId)) want(assetId, framePx * oversample);
  }

  const widths = new Map<string, number>();
  for (const [assetId, widthPx] of needed) {
    let width = Math.max(WIDTH_STEP, Math.ceil(widthPx / WIDTH_STEP) * WIDTH_STEP);
    // Clamp last so a 780 px phone screenshot is requested at 780, never upscaled.
    const realWidth = doc.assets.find((asset) => asset.id === assetId)?.width;
    if (realWidth && realWidth > 0) width = Math.min(width, realWidth);
    widths.set(assetId, width);
  }
  return widths;
}

/**
 * How far past the exact fit a texture keeps rows, as a fraction of the screen's height. A
 * screen's render target rounds its width and height to whole pixels (each up to 1.5 px off
 * after the target scale), and trilinear filtering reads up to two pixels' worth of rows below
 * the last row it shows: at most about 7 px of a phone screen's height, less on a landscape one.
 * 10% covers that on screens 70 px tall and taller, half the smallest screen the presets draw in
 * the visual stills (an orbit's side card at 360 × 640, about 140 px).
 */
export const ROWS_MARGIN = 0.1;

/**
 * Whether a shot moves its screenshots inside their screens: a single screen (Scroll Story) or
 * Responsive Scroll with scroll on (motion/evaluate.ts), and Page Columns always
 * (layouts/page-columns.ts). Every other layout shows the top of each screenshot, fit to its
 * screen's width (quality-bar §3.1).
 */
function scrollsScreenshots(shot: Shot): boolean {
  if (shot.layout.kind === "pageColumns") return true;
  const scrollable = shot.layout.kind === "single" || shot.layout.kind === "responsive";
  return scrollable && Boolean(shot.scroll?.enabled);
}

/**
 * At least the height of a node's screen, in screen widths. A phone's screen sits inside a border
 * of PHONE_BORDER body widths on every side (quality-bar §3.3) and a card's is the whole card. A
 * browser's is its window less the toolbar, so the window's height bounds it whatever the chrome.
 */
function screenHeightPerWidth(node: LayoutNode): number {
  if (node.device === "phone") {
    const border = 2 * PHONE_BORDER * node.width;
    return (node.height - border) / (node.width - border);
  }
  return node.height / node.width;
}

/**
 * The rows of each image asset a texture keeps, per pixel of the decoded width: a screen fits a
 * screenshot to its width, so one that never scrolls shows its top `width × rows` rows on its
 * tallest screen. The value is that screen's height in widths plus ROWS_MARGIN, or null to keep
 * the whole image: when a shot scrolls it, when it is no taller than that, or when the layout
 * lists it without placing it. The keys are exactly `collectAssetIds(doc)`. Like textureWidths
 * it reads the layouts at t = 0: node sizes don't depend on time, and every frame shows each
 * screenshot on a screen the first one has (tests/texture-rows.test.ts).
 */
export function textureRows(doc: ProjectDoc): Map<string, number | null> {
  const tallest = new Map<string, number>();
  const whole = new Set<string>();
  for (const shot of doc.shots) {
    if (scrollsScreenshots(shot)) {
      for (const assetId of layoutAssetIds(shot.layout)) whole.add(assetId);
      continue;
    }
    const nodes = resolveLayout(shot.layout, doc.aspect, doc.assets, 0, shot.duration);
    for (const node of nodes) {
      const height = screenHeightPerWidth(node);
      // Every pane is fit to the width of the screen it is on (contracts.md §4).
      const ids = node.panes ? node.panes.map((pane) => pane.assetId) : [node.assetId];
      for (const assetId of ids) {
        if (assetId) tallest.set(assetId, Math.max(tallest.get(assetId) ?? 0, height));
      }
    }
  }

  const rows = new Map<string, number | null>();
  for (const assetId of collectAssetIds(doc)) {
    const height = tallest.get(assetId);
    if (whole.has(assetId) || height === undefined) {
      rows.set(assetId, null);
      continue;
    }
    const kept = height * (1 + ROWS_MARGIN);
    const asset = doc.assets.find((a) => a.id === assetId);
    // A page that fits is kept whole, so its bottom row is still its own (the fill below it).
    const fits = asset?.width && asset.height && asset.height <= asset.width * kept;
    rows.set(assetId, fits ? null : kept);
  }
  return rows;
}

/**
 * Kept rows come in blocks of 64, so a kept texture's first six mip levels halve exactly, as a
 * tall page's 4096-row first strip's do. A screen that minifies the page then samples the same
 * mip texels from either; a mip level of odd height shifts its rows, which moved text edges in
 * Mobile Frames by up to 39 levels of 255 in a 1280 × 720 frame. A block adds under 64 rows,
 * 6% of a 1440 px desktop page's kept rows.
 */
const ROWS_BLOCK = 64;

/** How many of a decoded `width` × `height` image's rows `rows` (textureRows) keeps. */
export function keptRows(rows: number | null, width: number, height: number): number {
  if (rows === null) return height;
  return Math.min(height, Math.ceil((width * rows) / ROWS_BLOCK) * ROWS_BLOCK);
}

/** Whether a decode that kept `held` rows (textureRows) holds every row `wanted` asks for. */
export function holdsRows(held: number | null, wanted: number | null): boolean {
  return held === null || (wanted !== null && held >= wanted);
}

/** The larger of two textureRows values: null, the whole image, is the largest. */
export function moreRows(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : Math.max(a, b);
}
